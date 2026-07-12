# Wrapper script to execute preprocessing from Python via JSON

if (!requireNamespace("jsonlite", quietly = TRUE)) {
  install.packages("jsonlite", repos="https://cloud.r-project.org")
}
library(jsonlite)

args_all <- commandArgs(trailingOnly = FALSE)
file_arg <- grep("^--file=", args_all, value = TRUE)
if (length(file_arg) > 0) {
  script_dir <- dirname(sub("^--file=", "", file_arg[1]))
  source(file.path(script_dir, "preprocessing_page.R"))
} else {
  source("R/preprocessing_page.R")
}

args <- commandArgs(trailingOnly = TRUE)
if (length(args) < 2) {
  stop("Usage: Rscript run_preprocessing.R <input.json> <output.json>")
}

input_file <- args[1]
output_file <- args[2]

input_data <- fromJSON(input_file)

df <- as.data.frame(input_data$df_rows)
if (nrow(df) == 0 && length(input_data$df_rows) > 0) {
    # Single-row JSON may parse as a list instead of data.frame
    df <- do.call(rbind, lapply(input_data$df_rows, as.data.frame))
}

columns <- input_data$columns
missing_strategy <- input_data$missing_strategy
config <- input_data$config

res <- apply_preprocessing(df, columns, missing_strategy, config)

# auto_unbox=TRUE so scalar stats aren't wrapped in arrays
write_json(res, output_file, auto_unbox = TRUE, na = "null")
