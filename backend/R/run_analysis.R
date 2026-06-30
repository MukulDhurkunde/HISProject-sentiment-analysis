# run_analysis.R — Main orchestrator
#
# Entry point called by the Python backend.
# Reads the input JSON, sources each page module in order, writes the output JSON.
#
# Page modules (source order matters — each builds on the previous):
#   utils.R            shared helpers (install_if_missing, normalize_sentiment)
#   analysis_engine.R  lexicon scoring + ML training  → Analysis Engine page
#   insight_dashboard.R insights + chart data          → Insight Dashboard page
#
# JavaScript-only pages (no R involvement):
#   data_ingestion.R   Data Ingestion page
#   preprocessing_hub.R Preprocessing Hub page
#   generate_report.R  Generate Report page

args <- commandArgs(trailingOnly = TRUE)
if (length(args) < 2) {
  stop("Usage: Rscript run_analysis.R <infile.json> <outfile.json>")
}

infile  <- args[1]
outfile <- args[2]

# Resolve the directory of this script so sibling files can be sourced by path
all_args   <- commandArgs()
file_arg   <- all_args[grep("^--file=", all_args)]
script_dir <- if (length(file_arg) > 0) dirname(normalizePath(sub("^--file=", "", file_arg))) else getwd()

# Load shared helpers first
source(file.path(script_dir, "utils.R"))

suppressWarnings(suppressMessages({
  install_if_missing("jsonlite")
  install_if_missing("syuzhet")
  library(jsonlite)
  library(syuzhet)
}))

# Read input payload
payload      <- fromJSON(infile)
df_rows      <- payload$df_rows
text_column  <- payload$text_column
lexicon      <- payload$lexicon
sensitivity  <- payload$sensitivity
theme_count  <- payload$theme_count
ml_model     <- payload$ml_model
label_column <- payload$label_column

df <- as.data.frame(df_rows)
if (!text_column %in% colnames(df)) stop(sprintf("Text column '%s' not found in dataset", text_column))

texts       <- as.character(df[[text_column]])
word_counts <- sapply(strsplit(texts, "\\W+"), function(x) sum(nchar(x) > 0))
word_counts[word_counts == 0] <- 1

# Sensitivity → threshold: sensitivity=0 is strictest, sensitivity=100 means threshold=0
max_threshold <- if (lexicon == "afinn") 0.15 else 0.05
threshold     <- max_threshold * (1 - (sensitivity / 100))

# Run Analysis Engine (lexicon scoring + ML training)
source(file.path(script_dir, "analysis_engine.R"))

# Run Insight Dashboard (insights text + chart data + lexicon word lists)
source(file.path(script_dir, "insight_dashboard.R"))

# Write output JSON
output <- list(processed_rows = df, insights = insights)
if (!is.null(ml_metrics)) output$ml_metrics <- ml_metrics
if (!is.null(ml_error))   output$ml_error   <- ml_error

write_json(output, outfile, auto_unbox = TRUE, pretty = TRUE, na = "null")
cat("Analysis complete.\n")
