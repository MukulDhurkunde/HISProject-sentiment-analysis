# data_ingestion.R — Data Ingestion page
#
# This page is handled entirely in JavaScript (frontend).
#
# What happens here:
#   - User uploads a CSV / TSV / Excel file
#   - Papa Parse reads and previews the raw file in the browser
#   - User selects which column is the text column and (optionally) the label column
#   - Basic column detection and file validation run client-side
#
# R is not involved at this stage.
# The selected column names (text_column, label_column) are forwarded to the
# Analysis Engine as part of the JSON payload when the user runs the analysis.
