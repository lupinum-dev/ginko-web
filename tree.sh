#!/bin/bash

# Function to print directory structure
print_structure() {
    local dir="$1"
    local prefix="$2"

    # Loop through the files and directories
    for entry in "$dir"/*; do
        if [[ -d "$entry" ]]; then
            echo "${prefix} $(basename "$entry")/"
            print_structure "$entry" "$prefix    "
        else
            echo "${prefix} $(basename "$entry")"
        fi
    done
}

# Start from the current directory or user-provided directory
start_dir="${1:-.}"

echo "$(basename "$start_dir")"
print_structure "$start_dir" "  "
