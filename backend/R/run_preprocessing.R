# Wrapper script to execute preprocessing from Python via JSON

# Ensure jsonlite is available
if (!requireNamespace("jsonlite", quietly = TRUE)) {
  install.packages("jsonlite", repos="https://cloud.r-project.org")
}
library(jsonlite)

# Source the main preprocessing script safely
args_all <- commandArgs(trailingOnly = FALSE)
file_arg <- grep("^--file=", args_all, value = TRUE)
if (length(file_arg) > 0) {
  script_dir <- dirname(sub("^--file=", "", file_arg[1]))
  source(file.path(script_dir, "02_preprocessing.R"))
} else {
  source("R/02_preprocessing.R")
}

args <- commandArgs(trailingOnly = TRUE)
if (length(args) < 2) {
  stop("Usage: Rscript run_preprocessing.R <input.json> <output.json>")
}

input_file <- args[1]
output_file <- args[2]

# Read input JSON
# Expected format:
# {
#   "df_rows": [{"col1": "val", "col2": "val"}, ...],
#   "columns": ["col1"],
#   "missing_strategy": "skip",
#   "config": {
#     "lowercase": true,
#     "removeUrlsHtml": true,
#     "stopwords": false,
#     "punctuation": true,
#     "specialChars": true,
#     "numbers": false
#   }
# }
input_data <- fromJSON(input_file)

# The dataframe can sometimes come as a list if it's empty, ensure it's a dataframe
df <- as.data.frame(input_data$df_rows)
if (nrow(df) == 0 && length(input_data$df_rows) > 0) {
    # It might be parsed strangely if only 1 row
    df <- do.call(rbind, lapply(input_data$df_rows, as.data.frame))
}

columns <- input_data$columns
missing_strategy <- input_data$missing_strategy
config <- input_data$config

# Run the R logic
res <- apply_preprocessing(df, columns, missing_strategy, config)

# The processed_df might contain NA, which jsonlite converts to null, which is good.
# Write output JSON
# Note: auto_unbox = TRUE to ensure single values like stats are not arrays
write_json(res, output_file, auto_unbox = TRUE, na = "null")
