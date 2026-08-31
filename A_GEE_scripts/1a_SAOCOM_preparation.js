// =========================================================================
// MODULE 1a -- SAOCOM image preparation (HH/HV)
// =========================================================================

// OBJECTIVE: This script loads the SAOCOM HH and HV amplitude image assets,
// applies a no-data mask, converts the calibrated amplitude values to dB
// using an epsilon floor to avoid log-scale issues, and prepares the HH/HV
// ratio composite for subsequent random-forest feature extraction.

// RUN IT IN GOOGLE EARTH ENGINE.

// -------------------------------------------------------------------------
// 1. UPLOAD ASSETS
// -------------------------------------------------------------------------
var ASSET_HH_LINEAR = 'projects/divine-engine-488410-g2/assets/images/saocom_hh_frame';
var ASSET_HV_LINEAR = 'projects/divine-engine-488410-g2/assets/images/saocom_hv_frame';

// -------------------------------------------------------------------------
// 2. SET THE EPSILON FLOOR
// -------------------------------------------------------------------------
// EPSILON is retained as a very small numerical floor to avoid log10(0)
// and extreme non-positive values during the logarithmic transformation.
// With the correct amplitude conversion (20*log10), 0.0001 corresponds
// to -80 dB, which remains far below the nominal SAOCOM dual-pol NESZ
// (~ -28 dB) and therefore should not truncate physically meaningful signal.
var EPSILON = 0.0001;

// -------------------------------------------------------------------------
// 3. LOAD IMAGE AND APPLY NO-DATA MASK
// -------------------------------------------------------------------------
var hhLinear = ee.Image(ASSET_HH_LINEAR);
var hvLinear = ee.Image(ASSET_HV_LINEAR);

hhLinear = hhLinear.updateMask(hhLinear.neq(0));
hvLinear = hvLinear.updateMask(hvLinear.neq(0));


// -------------------------------------------------------------------------
// 4. CONVERT THE VALUES TO dB
// -------------------------------------------------------------------------
// SAOCOM L1D products are radiometrically calibrated in sigma0 but are
// distributed as detected amplitude values.
// Therefore, conversion to dB requires 20*log10(amplitude).
// `.max(EPSILON)` provides a numerical safeguard before log10. With 20*log10, EPSILON = 0.0001 corresponds to -80 dB.
var hhDB = hhLinear.max(EPSILON).log10().multiply(20).rename('HH');
var hvDB = hvLinear.max(EPSILON).log10().multiply(20).rename('HV');

// -------------------------------------------------------------------------
// 5. CALCULATE THE RATIO (HH - HV) AND CREATE THE COMPOSITE
// -------------------------------------------------------------------------
var ratio = hhDB.subtract(hvDB).rename('ratio');

var saocomComposite = hhDB.addBands(hvDB).addBands(ratio);

// -------------------------------------------------------------------------
// 6. SANITY CHECK FUNCTION
// -------------------------------------------------------------------------
function reportStatistics(geometry) {
  var stats = saocomComposite.reduceRegion({
    reducer: ee.Reducer.mean()
      .combine({ reducer2: ee.Reducer.minMax(), sharedInputs: true })
      .combine({ reducer2: ee.Reducer.count(), sharedInputs: true }),
    geometry: geometry,
    scale: 10,
    maxPixels: 1e9,
    bestEffort: true
  });

  print('Module 1a SAOCOM -- HH/HV/ratio statistics (dB):', stats);
  return stats;
}

// -------------------------------------------------------------------------
// 7. EXPORTS
// -------------------------------------------------------------------------
exports.hhLinear = hhLinear;             // calibrated amplitude, masked
exports.hvLinear = hvLinear;             // calibrated amplitude, masked
exports.hhDB = hhDB;                     // sigma0-equivalent backscatter in dB
exports.hvDB = hvDB;
exports.ratio = ratio;
exports.composite = saocomComposite;     // HH, HV, ratio bands -- for RF features
exports.EPSILON = EPSILON;
exports.reportStatistics = reportStatistics;
