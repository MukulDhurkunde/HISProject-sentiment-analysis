# generate_report.R — Generate Report page
#
# This page is handled entirely in JavaScript/React (frontend).
#
# What happens here:
#   - ReportModal.jsx reads analysisResults from DatasetContext
#   - Computes per-class statistics (average score, review count, text length) in the browser
#   - Calculates ML agreement rate (% rows where ML label matches original label) client-side
#   - Renders a printable PDF-style modal with charts and summary tables using React
#
# R is not involved at this stage.
# All report data is derived from the JSON output already produced
# by analysis_engine.R and insight_dashboard.R.
