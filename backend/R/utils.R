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
