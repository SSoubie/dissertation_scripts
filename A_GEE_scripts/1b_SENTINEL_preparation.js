// =========================================================================
// MODULE 1b -- SENTINEL-1 image preparation
// =========================================================================

// OBJECTIVE: This section loads the Sentinel-1 anchor scene corresponding to the predefined study period and relative orbit, using the shared parameters established in Module 0. The module extracts the VV and VH backscatter bands and the local incidence angle without applying additional filtering or compositing, leaving these operations to the subsequent processing stage.

// RUN IT IN GOOGLE EARTH ENGINE.

// We upload the parameter settings from module0, which contains the study area, date range, and relative orbit number for the Sentinel-1 anchor scene.
var params = require('users/SSoubie95/CASA25:Dissertation/0_data_load_and_parameter_settings'); // ADJUST path

// -------------------------------------------------------------------------
// WE LOAD THE SENTINEL-1 ANCHOR SCENE
// -------------------------------------------------------------------------
var s1Scene = ee.Image(
  ee.ImageCollection('COPERNICUS/S1_GRD')
    .filterBounds(params.basin)
    .filterDate(params.SAR_DATE_START, params.SAR_DATE_END)
    .filter(ee.Filter.eq('instrumentMode', 'IW'))
    .filter(ee.Filter.eq('orbitProperties_pass', 'ASCENDING'))
    .filter(ee.Filter.eq('relativeOrbitNumber_start', params.SAR_RELATIVE_ORBIT))
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
    .first()
);

// Reproducibility check.
print(
  'Selected Sentinel-1 scene:',
  s1Scene.get('system:index')
);

print(
  'Sentinel-1 acquisition date:',
  s1Scene.date()
);


// -------------------------------------------------------------------------
// EXPORTS -- raw scene and individual raw bands (VV/VH already in dB per
// GEE's S1 GRD product; 'angle' is the local incidence angle band)
// -------------------------------------------------------------------------
exports.scene = s1Scene;
exports.vvRaw = s1Scene.select('VV').reproject({ crs: params.WORKING_CRS, scale: 10 });
exports.vhRaw = s1Scene.select('VH').reproject({ crs: params.WORKING_CRS, scale: 10 });
exports.angle = s1Scene.select('angle').reproject({ crs: params.WORKING_CRS, scale: 10 });
exports.date = s1Scene.date();