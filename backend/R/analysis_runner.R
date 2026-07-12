# analysis_runner.R: Orchestrates the Analysis and Dashboard pages.

args <- commandArgs(trailingOnly = TRUE)
if (length(args) < 2) {
  stop("Usage: Rscript run_analysis.R <infile.json> <outfile.json>")
}

infile  <- args[1]
outfile <- args[2]

all_args   <- commandArgs()
file_arg   <- all_args[grep("^--file=", all_args)]
script_dir <- if (length(file_arg) > 0) dirname(normalizePath(sub("^--file=", "", file_arg))) else getwd()

source(file.path(script_dir, "utils.R"))

suppressWarnings(suppressMessages({
  install_if_missing("jsonlite")
  install_if_missing("syuzhet")
  library(jsonlite)
  library(syuzhet)
}))

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

# Exclude placeholder rows from analysis
skip_mask <- df[[text_column]] == "[No Review]" | 
             tolower(trimws(as.character(df[[text_column]]))) == "no review" | 
             tolower(trimws(as.character(df[[text_column]]))) == "[no review]"

if (any(skip_mask, na.rm = TRUE)) {
  df <- df[!skip_mask, ]
}

texts       <- as.character(df[[text_column]])
word_counts <- sapply(strsplit(texts, "\\W+"), function(x) sum(nchar(x) > 0))
word_counts[word_counts == 0] <- 1

# sensitivity=0 → strictest threshold, sensitivity=100 → threshold=0
max_threshold <- if (lexicon == "afinn") 0.15 else 0.05
threshold     <- max_threshold * (1 - (sensitivity / 100))

source(file.path(script_dir, "analysis_page.R"))

source(file.path(script_dir, "dashboard_page.R"))

output <- list(processed_rows = df, insights = insights)
if (!is.null(ml_metrics)) output$ml_metrics <- ml_metrics
if (!is.null(ml_error))   output$ml_error   <- ml_error

write_json(output, outfile, auto_unbox = TRUE, pretty = TRUE, na = "null")
cat("Analysis complete.\n")
