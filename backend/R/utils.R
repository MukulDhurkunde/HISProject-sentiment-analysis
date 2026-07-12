# utils.R: Shared helper functions used across all R modules

install_if_missing <- function(pkg) {
  if (!requireNamespace(pkg, quietly = TRUE)) {
    cat(sprintf("Installing package '%s'...\n", pkg))
    dir.create(Sys.getenv("R_LIBS_USER"), recursive = TRUE, showWarnings = FALSE)
    suppressMessages(install.packages(pkg, lib = Sys.getenv("R_LIBS_USER"),
                                      repos = "https://cloud.r-project.org", quiet = TRUE))
  }
}

# Maps common label formats to Positive/Negative/Neutral
normalize_sentiment <- function(lbl) {
  l <- trimws(tolower(as.character(lbl)))
  if (l %in% c("positive", "pos", "1", "good", "true"))  return("Positive")
  if (l %in% c("negative", "neg", "-1", "bad", "false")) return("Negative")
  if (l %in% c("neutral",  "neu", "0",  "mixed"))        return("Neutral")
  paste0(toupper(substr(l, 1, 1)), substring(l, 2))
}

# Detects 1-5 star ratings (1-2→Neg, 3→Neu, 4-5→Pos), else per-label normalization
normalize_label_set <- function(labels_vec) {
  raw          <- trimws(as.character(labels_vec))
  numeric_vals <- suppressWarnings(as.numeric(raw))
  all_numeric  <- !any(is.na(numeric_vals))

  if (all_numeric) {
    unique_vals <- sort(unique(numeric_vals))
    # Only treat as star scale if values are integers in [1,5] with max >= 4
    is_star_rating <- all(unique_vals %in% 1:5) && max(unique_vals) >= 4
    if (is_star_rating) {
      return(ifelse(numeric_vals >= 4, "Positive",
             ifelse(numeric_vals <= 2, "Negative", "Neutral")))
    }
  }

  # Fallback to per-label text normalization
  vapply(raw, normalize_sentiment, character(1))
}
