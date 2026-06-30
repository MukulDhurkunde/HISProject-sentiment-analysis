# preprocessing_hub.R — Preprocessing Hub page
#
# This page is handled entirely in JavaScript (frontend).
#
# What happens here:
#   - User configures text cleaning options: lowercase, remove punctuation,
#     strip numbers, remove stopwords, trim whitespace
#   - Transformations are applied in the browser via JavaScript string operations
#   - A live before/after preview of cleaned text is shown row by row
#   - The cleaned dataset remains in-browser memory until the user proceeds
#
# R is not involved at this stage.
# Pre-processed text arrives in the JSON payload under the chosen text_column
# when the analysis is triggered from the Analysis Engine page.
