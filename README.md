# DISSERTATION 

This repository contains the code used within the dissertation to assess the ability of C-band and L-band Synthetic Aperture Radar (SAR) data to discriminate locations associated with beaver activity in the Tolhuin Forest Basin, Tierra del Fuego, Argentina.

The analysis compares Sentinel-1 C-band SAR and SAOCOM L-band SAR using Random Forest classification at two spatial representations:

- **Pixel level**
- **Neighbourhood level**

Three predictor sets are evaluated in both cases: Sentinel-1 only, SAOCOM only, and the combination of both sensors.

## Repository structure

A_GEE_scripts/       Google Earth Engine preprocessing and sample generation
B_python_scripts/    Random Forest modelling and evaluation
data/                Final modelling datasets


## Workflow

The **Google Earth Engine (GEE)** scripts should be run in the following order:

+ *0_data_load_and_parameter_settings.js*
Loads common parameters, study-area data and asset paths.
+ *1a_SAOCOM_preparation.js*
Prepares and converts SAOCOM HH/HV data.
+ *1b_SENTINEL_preparation.js*
Loads and prepares the selected Sentinel-1 VV/VH acquisition.
+ *2_roi_preparation.js*
Creates the common study-area mask and applies water, snow/ice and terrain exclusions.
+ *3_composite_creation.js*
Creates and exports the final Sentinel-1 and SAOCOM composites.
+ *4_sample_making.js*
Generates the pixel-level positive and pseudo-absence sample.
+ *5_sample_making_neighbourhoods.js*
Uses the same sample centres to calculate neighbourhood-level SAR statistics.

The, the **Jupiter Notebooks** scripts should be run in the following order:

+ *1_rf_pixel_level.ipynb*
Runs the Random Forest classification at the pixel level.
+ *2_rf_neighbourhood_level.ipynb*
Runs the Random Forest classification at the neighbourhood level.

## Main software
+ Google Earth Engine
+ Python
+ pandas
+ NumPy
+ scikit-learn
+ SciPy
+ matplotlib