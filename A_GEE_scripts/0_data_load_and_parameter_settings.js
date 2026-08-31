// =========================================================================
// MODULE 0 -- Set shared parameters and datasets
// =========================================================================

// OBJECTIVE: This script defines and exports the shared datasets and parameters used throughout the preprocessing workflow, including the study basin, reference ground-truth data, working CRS, and the temporal anchor dates for the Sentinel-1 and optical datasets.

// RUN IT IN GOOGLE EARTH ENGINE.

// -------------------------------------------------------------------------
// Upload Region of Interest: Tolhuin Basin
// -------------------------------------------------------------------------

exports.basin = ee.FeatureCollection('projects/divine-engine-488410-g2/assets/polygons/tolhuin_basin');
exports.basinGeom = exports.basin.geometry();

// -------------------------------------------------------------------------
// Set Working CRS.
// Intended reference frame: POSGAR 2007 / UTM 19S (EPSG:9265), Argentina's
// official geodetic standard. However, GEE's internal CRS database does not
// recognize EPSG:9265 ("CRS could not be parsed"). 
// EPSG:32719 (WGS84/UTM 19S) is used instead: identical projection parameters 
// (ellipsoid, central meridian, scale factor, false easting/northing) to POSGAR07/
// UTM19S, differing only in the underlying datum realization by a few cm-dm.
// -------------------------------------------------------------------------

exports.WORKING_CRS = 'EPSG:32719';

// -------------------------------------------------------------------------
// Sentinel-1 Temporal anchor.
// 20-22 March 2025 / relative orbit 62 (ascending) chosen to align with
// the SAOCOM Stripmap pair (25 March 2025) and the optical confirmation
// window (11-26 March 2025), so all sensors describe roughly the same
// ground conditions.
// -------------------------------------------------------------------------

exports.SAR_DATE_START = '2025-03-20';
exports.SAR_DATE_END = '2025-03-22';
exports.SAR_RELATIVE_ORBIT = 62;
exports.OPTICAL_DATE_START = '2025-03-11';
exports.OPTICAL_DATE_END = '2025-03-27'; // GEE filterDate() uses an exclusive end date. Therefore, 2025-03-27 is used to include imagery acquired through
