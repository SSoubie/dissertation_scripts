// =========================================================================
// MODULE 4 - GENERATE SAR MODELLING DATASET
// =========================================================================

// OBJECTIVE: This script generates a modelling dataset for the random-forest classification of beaver dams using the corrected Sentinel-1 and SAOCOM composites. The dataset includes positive samples (mapped beaver dams) and pseudo-absence samples (random points outside mapped dams), along with six SAR features (VV, VH, HH, HV, and their respective ratios).


// -------------------------------------------------------------------------
// 1. LOAD PARAMETERS
// -------------------------------------------------------------------------
var params = require('users/SSoubie95/CASA25:Dissertation/0_data_load_and_parameter_settings');


// -------------------------------------------------------------------------
// 2. LOAD SAR COMPOSITES
// -------------------------------------------------------------------------
var s1 = ee.Image('projects/divine-engine-488410-g2/assets/images/s1_composite_corrected')
  .select(
    ['VV', 'VH', 'ratio'],
    ['s1_VV', 's1_VH', 's1_ratio']
  );

var sao = ee.Image('projects/divine-engine-488410-g2/assets/images/saocom_composite_corrected')
  .select(
    ['HH', 'HV', 'ratio'],
    ['sao_HH', 'sao_HV', 'sao_ratio']
  );

// -------------------------------------------------------------------------
// 3. BUILD SIX-FEATURE SAR STACK
// -------------------------------------------------------------------------
var stack = s1.addBands(sao);

// A pixel is valid only when all six SAR predictors are available.
var validBand = stack
  .mask()
  .reduce(ee.Reducer.min())
  .rename('valid');

var stackV = stack.addBands(validBand);

print(
  'Bands in SAR stack:',
  stackV.bandNames()
);

// -------------------------------------------------------------------------
// 4. LOAD MAPPED BEAVER DAMS
// -------------------------------------------------------------------------
var dams = ee.FeatureCollection('projects/divine-engine-488410-g2/assets/basin_beavers_dams');

// -------------------------------------------------------------------------
// 5. DEFINE POSITIVE SAMPLES
// -------------------------------------------------------------------------
// All mapped dams are initially included.
// Locations outside the valid common SAR footprint are subsequently
// removed when sampling the stack.
var posPts = dams
  .map(function (f) {
    return f.set({
      'class': 1,
      'source': 'inventory'
    });
  })
  .select(['class', 'source']);

// -------------------------------------------------------------------------
// 6. DEFINE ROI FOR PSEUDO-ABSENCE SAMPLING
// -------------------------------------------------------------------------
// The corrected Sentinel-1 composite already uses the common operational
// mask shared by the Sentinel-1 and SAOCOM composites.

var roiImg = ee.Image('projects/divine-engine-488410-g2/assets/images/s1_composite_corrected')
  .mask()
  .reduce(ee.Reducer.min())
  .gt(0);

// -------------------------------------------------------------------------
// 7. EXCLUDE 30 m AROUND ALL MAPPED DAMS FROM NEGATIVE SAMPLING
// -------------------------------------------------------------------------
var damBuf = ee.Image()
  .byte()
  .paint(
    dams.map(function (f) {
      return f.buffer(30);
    }),
    1
  )
  .unmask(0);

// Pixels eligible for pseudo-absence sampling.
var negElig = roiImg
  .and(damBuf.eq(0))
  .selfMask();

// -------------------------------------------------------------------------
// 8. GENERATE PSEUDO-ABSENCE SAMPLES
// -------------------------------------------------------------------------
var negPts = negElig
  .sample({
    region: params.basinGeom,
    scale: 10,
    projection: params.WORKING_CRS,
    numPixels: 150000,
    seed: 42,
    geometries: true
  })
  .map(function (f) {
    return f.set({
      'class': 0,
      'source': 'random'
    });
  })
  .select(['class', 'source']);

// -------------------------------------------------------------------------
// 9. SAMPLE THE SIX SAR FEATURES
// -------------------------------------------------------------------------
var allPts = posPts.merge(negPts);
var sampled = stackV.sampleRegions({
  collection: allPts,
  properties: ['class', 'source'],
  scale: 10,
  projection: params.WORKING_CRS,
  tileScale: 8,
  geometries: true
});

// Retain only observations with all six SAR predictors available.
var clean = sampled
  .filter(ee.Filter.eq('valid', 1));

// -------------------------------------------------------------------------
// 10. FINAL DATASET CONTROL
// -------------------------------------------------------------------------
var cleanPos = clean
  .filter(ee.Filter.eq('class', 1));

var cleanNeg = clean
  .filter(ee.Filter.eq('class', 0));

print(
  'FINAL -- positive samples:',
  cleanPos.size()
);

print(
  'FINAL -- pseudo-absence samples:',
  cleanNeg.size()
);

print(
  'FINAL -- total modelling samples:',
  clean.size()
);

// -------------------------------------------------------------------------
// 11. ADD X/Y COORDINATES IN EPSG:32719
// -------------------------------------------------------------------------
var withXY = clean.map(function (f) {

  var c = f.geometry()
    .transform(params.WORKING_CRS, 1)
    .coordinates();

  return f.set({
    'x': ee.Number(c.get(0)),
    'y': ee.Number(c.get(1))
  });

});

// -------------------------------------------------------------------------
// 12. EXPORT MODELLING DATASET
// -------------------------------------------------------------------------
Export.table.toDrive({
  collection: withXY,
  description: 'rf_dataset_s1_saocom_corrected',
  fileFormat: 'CSV',
  selectors: [
    'class',
    'source',
    'x',
    'y',
    's1_VV',
    's1_VH',
    's1_ratio',
    'sao_HH',
    'sao_HV',
    'sao_ratio'
  ]
});
