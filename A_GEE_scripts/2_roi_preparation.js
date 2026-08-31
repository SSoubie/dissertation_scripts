// =========================================================================
// MODULE 2 -- Region-of-interest preparation and primary filtering for both sensors
// =========================================================================  


// OBJECTIVE: This section defines the shared valid-pixel mask and applies the primary exclusion criteria for both Sentinel-1 and SAOCOM. It removes permanent water, snow/ice, and layover-affected areas, then constrains both datasets to the same effective study area using the SAOCOM footprint mask. The goal is to ensure that the two sensors are compared over the same spatial extent and valid pixels before further processing and analysis

// RUN IT IN GOOGLE EARTH ENGINE.

// WE UPLOAD THE PARAMETER SETTINGS FROM MODULE0 AND THE RAW DATA FROM MODULE1 FOR BOTH SENSORS.
var params = require('users/SSoubie95/CASA25:Dissertation/0_data_load_and_parameter_settings');
var s1Raw = require('users/SSoubie95/CASA25:Dissertation/1b_SENTINEL_preparation');
var saocom = require('users/SSoubie95/CASA25:Dissertation/1a_SAOCOM_preparation');

// WE SET THE GEOMETRY OF THE STUDY AREA (BASIN) FOR CLIPPING AND MASKING PURPOSES.
var basinGeom = params.basinGeom;

// -------------------------------------------------------------------------
// 1. WE UPLOAD THE SENSOR-INDEPENDENT MASKS (PERMANENT WATER AND SNOW/ICE)
// -------------------------------------------------------------------------

// First, we create a permanent water mask using the JRC Global Surface Water dataset (JRC/GSW1_4/MonthlyHistory).
// We consider pixels that are classified as water for more than 90% of the time // Permanent water occurrence between 2002 and 2019
var monthlyHistory = ee.ImageCollection('JRC/GSW1_4/MonthlyHistory').filterDate('2002-01-01', '2020-01-01'); // (2020-01-01 is the exclusive end date in GEE).
var isPermanentWater = monthlyHistory.map(function (i) { return i.eq(2); }).sum()
  .divide(monthlyHistory.map(function (i) { return i.gt(0); }).sum())
  .multiply(100).gt(90).unmask(0).clip(basinGeom);

function maskCloudsSCL(image) {
  var scl = image.select('SCL');
  var isCloudOrShadow = scl.gte(3).and(scl.lte(10)).and(scl.neq(4)).and(scl.neq(5)).and(scl.neq(6));
  return image.updateMask(isCloudOrShadow.not());
}

// Next, we create a snow/ice mask using Sentinel-2 surface reflectance data (COPERNICUS/S2_SR_HARMONIZED) and the Scene Classification Layer (SCL). We mask out clouds and shadows, and then identify pixels classified as snow/ice (SCL value 11).
var isSnow = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(params.basin)
  .filterDate(params.OPTICAL_DATE_START, params.OPTICAL_DATE_END)
  .map(maskCloudsSCL)
  .sort('CLOUDY_PIXEL_PERCENTAGE', false)
  .select('SCL')
  .mosaic()
  .eq(11)
  .unmask(0)
  .clip(basinGeom);

// Finally, we combine these two masks to create a shared valid pixel mask that excludes permanent water and snow/ice areas.  
var sharedMask = isPermanentWater.not().and(isSnow.not());

// -------------------------------------------------------------------------
// 2. WE CREATE A LAYOVER MASK
//
// SAOCOM's uploaded assets carry no per-pixel incidence-angle band, only
// the nominal submode range (S4: 33.7-38.3 deg) -- so
// a true per-pixel layover test for SAOCOM alone isn't possible with what's
// currently available. To make the two sensors' footprints genuinely
// equivalent, Sentinel-1's own incidence angle (~36.9 deg, well within
// SAOCOM S4's range) is used as a shared proxy for both sensors. Documented
// approximation, not a measurement of SAOCOM's real per-pixel geometry, but
// acceptable because both sensors view the same terrain with broadly
// similar look geometry. 
// -------------------------------------------------------------------------
var glo30UTM = ee.ImageCollection('COPERNICUS/DEM/GLO30_2024_1')
  .filterBounds(basinGeom).select('DEM').mosaic()
  .reproject({ crs: params.WORKING_CRS, scale: 30 });
var isLayoverShared = ee.Terrain.slope(glo30UTM).gt(s1Raw.angle).unmask(0).clip(basinGeom);

var sharedValidMask = sharedMask.and(isLayoverShared.not());

// -------------------------------------------------------------------------
// 3. WE CREATE A SAOCOM FOOTPRINT MASK
//
// Create the SAOCOM footprint mask to enforce the common study-area constraint
// across both sensors. This mask is derived from the no-data mask already 
// generated during SAOCOM preprocessing, avoiding the need for a separate polygon layer.
// -------------------------------------------------------------------------
var saocomFootprintMask = saocom.hhLinear.mask().and(saocom.hvLinear.mask());

// -------------------------------------------------------------------------
// 4. WE CREATE A FINAL COMBINED MASK 
//
// Combine the shared validity mask with the SAOCOM footprint mask so that
// both sensors are restricted to the same valid spatial extent. This ensures
// that the final Sentinel-1 and SAOCOM composites are directly comparable
// on a pixel-by-pixel basis, rather than merely covering a similar area.
// -------------------------------------------------------------------------
var s1CombinedMask = sharedValidMask.and(saocomFootprintMask);
var saocomCombinedMask = sharedValidMask.and(saocomFootprintMask);

// -------------------------------------------------------------------------
// 5. APPLY SENTINEL-1 PROCESSING: VALID-PIXEL MASK + 3x3 LOCAL MEAN SMOOTHING
//
// Apply the final valid-pixel mask to the raw VV and VH bands, clip to the
// basin extent,mooth with a 3x3 local mean filter to reduce pixel-scale variability, and reapply
// the mask before computing the VV-VH ratio. This ensures that the Sentinel-1
// composite is both spatially consistent with SAOCOM and less affected by local
// pixel noise.
// -------------------------------------------------------------------------
var vvSmoothed = s1Raw.vvRaw
  .updateMask(s1CombinedMask).clip(basinGeom)
  .focalMean({ radius: 1, kernelType: 'square', units: 'pixels' })
  .updateMask(s1CombinedMask)
  .rename('VV');
var vhSmoothed = s1Raw.vhRaw
  .updateMask(s1CombinedMask).clip(basinGeom)
  .focalMean({ radius: 1, kernelType: 'square', units: 'pixels' })
  .updateMask(s1CombinedMask)
  .rename('VH');
var s1Ratio = vvSmoothed.subtract(vhSmoothed).rename('ratio');
var s1Composite = vvSmoothed.addBands(vhSmoothed).addBands(s1Ratio);

// -------------------------------------------------------------------------
// 6. APPLY SAOCOM PROCESSING: VALID-PIXEL MASK + 3x3 LOCAL MEAN SMOOTHING
//
// Apply the same final valid-pixel mask and 3x3 smoothing window used for
// Sentinel-1 to the SAOCOM HH and HV backscatter layers. This keeps the two
// sensors consistent in preprocessing and avoids comparing a smoothed Sentinel-1
// product against an unsmoothed SAOCOM product. The HH-HV ratio is then
// calculated after smoothing, following the same order used for Sentinel-1.
//
// Note: the smoothing kernel is applied uniformly across both sensors even
// though their native resolutions differ. This is an accepted trade-off in the
// current workflow and is retained to preserve comparability between the two
// datasets.
// -------------------------------------------------------------------------
var hhSmoothed = saocom.hhDB
  .updateMask(saocomCombinedMask).clip(basinGeom)
  .focalMean({ radius: 1, kernelType: 'square', units: 'pixels' })
  .updateMask(saocomCombinedMask)
  .rename('HH');
var hvSmoothed = saocom.hvDB
  .updateMask(saocomCombinedMask).clip(basinGeom)
  .focalMean({ radius: 1, kernelType: 'square', units: 'pixels' })
  .updateMask(saocomCombinedMask)
  .rename('HV');
var saocomRatio = hhSmoothed.subtract(hvSmoothed).rename('ratio');
var saocomComposite = hhSmoothed.addBands(hvSmoothed).addBands(saocomRatio);

// -------------------------------------------------------------------------
// 7. SANITY CHECK FUNCTION
// -------------------------------------------------------------------------
function reportStatistics(geometry) {
  print('Module 2 -- Sentinel-1 VV/VH/ratio statistics (dB):',
    s1Composite.reduceRegion({
      reducer: ee.Reducer.mean().combine({ reducer2: ee.Reducer.count(), sharedInputs: true }),
      geometry: geometry, scale: 10, maxPixels: 1e9, bestEffort: true
    }));
  print('Module 2 -- SAOCOM HH/HV/ratio statistics (dB), footprint-restricted:',
    saocomComposite.reduceRegion({
      reducer: ee.Reducer.mean().combine({ reducer2: ee.Reducer.count(), sharedInputs: true }),
      geometry: geometry, scale: 10, maxPixels: 1e9, bestEffort: true
    }));
}

// -------------------------------------------------------------------------
// 8. EXPORTS
// -------------------------------------------------------------------------
exports.s1Composite = s1Composite;           // VV, VH, ratio -- masked, smoothed SAOCOM-footprint-restricted
exports.saocomComposite = saocomComposite;   // HH, HV, ratio -- masked, footprint-restricted
exports.s1CombinedMask = s1CombinedMask;
exports.saocomCombinedMask = saocomCombinedMask;
exports.sharedMask = sharedMask;             // water+snow only, no footprint, no layover 
exports.reportStatistics = reportStatistics;
