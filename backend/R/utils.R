# utils.R — Shared helper functions used across all R modules

install_if_missing <- function(pkg) {
  if (!requireNamespace(pkg, quietly = TRUE)) {
    cat(sprintf("Installing package '%s'...\n", pkg))
    dir.create(Sys.getenv("R_LIBS_USER"), recursive = TRUE, showWarnings = FALSE)
    suppressMessages(install.packages(pkg, lib = Sys.getenv("R_LIBS_USER"),
                                      repos = "https://cloud.r-project.org", quiet = TRUE))
  }
}

# Maps any common label format → Positive / Negative / Neutral (Title Case)
normalize_sentiment <- function(lbl) {
  l <- trimws(tolower(as.character(lbl)))
  if (l %in% c("positive", "pos", "1", "good", "true"))  return("Positive")
  if (l %in% c("negative", "neg", "-1", "bad", "false")) return("Negative")
  if (l %in% c("neutral",  "neu", "0",  "mixed"))        return("Neutral")
  paste0(toupper(substr(l, 1, 1)), substring(l, 2))
}

# Context-aware normalization for a full label vector.
# Detects 1-5 star rating columns before falling back to per-label normalize_sentiment().
# 1-2 → Negative, 3 → Neutral, 4-5 → Positive.
normalize_label_set <- function(labels_vec) {
  raw          <- trimws(as.character(labels_vec))
  numeric_vals <- suppressWarnings(as.numeric(raw))
  all_numeric  <- !any(is.na(numeric_vals))

  if (all_numeric) {
    unique_vals <- sort(unique(numeric_vals))
    # Exactly a 1-5 star scale: all values are integers within [1, 5]
    is_star_rating <- all(unique_vals %in% 1:5) && max(unique_vals) >= 4
    if (is_star_rating) {
      return(ifelse(numeric_vals >= 4, "Positive",
             ifelse(numeric_vals <= 2, "Negative", "Neutral")))
    }
  }

  # Fall back to per-label text normalization
  vapply(raw, normalize_sentiment, character(1))
}
