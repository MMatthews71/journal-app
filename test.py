import glob
import os

# Path to your folder containing the txt files
folder_path = r'C:\Users\maxma\Desktop\Personal\Journal Entries'

# Define output file path
output_file = os.path.join(folder_path, 'merged_journal.txt')

# Delete old merged file if it exists
if os.path.exists(output_file):
    os.remove(output_file)
    print(f"Deleted existing {output_file}")

# List all txt files in the folder
# Use a more robust exclusion method and natural sorting
txt_files = [
    f for f in glob.glob(os.path.join(folder_path, '*.txt'))
    if os.path.basename(f) != 'merged_journal.txt'
]

# Natural sort function to maintain expected order
def natural_sort_key(filename):
    import re
    return [int(text) if text.isdigit() else text.lower()
            for text in re.split(r'(\d+)', filename)]

# Sort files naturally (preserves numerical order)
txt_files.sort(key=lambda x: natural_sort_key(os.path.basename(x)))

print("Files to be merged (in order):")
for i, f in enumerate(txt_files, 1):
    print(f"{i}. {os.path.basename(f)}")

# Helper function to merge all files into one output file
def merge_files(file_list, output_path):
    with open(output_path, 'w', encoding='utf-8') as outfile:
        for i, fname in enumerate(file_list):
            print(f"Merging {i+1}/{len(file_list)}: {os.path.basename(fname)}")
            with open(fname, 'r', encoding='utf-8') as infile:
                content = infile.read()
                outfile.write(content)
                # Add separator between files (optional)
                if i < len(file_list) - 1:  # Don't add after last file
                    outfile.write('\n' + '='*50 + '\n\n')
    print(f"\nMerged {len(file_list)} files into {output_path}")

# Merge all files into one
merge_files(txt_files, output_file)

# Verify the merge worked
if os.path.exists(output_file):
    with open(output_file, 'r', encoding='utf-8') as f:
        line_count = len(f.readlines())
    print(f"Merge successful! Output file has approximately {line_count} lines.")
else:
    print("Error: Output file was not created!")

print(f"Done. Total files merged: {len(txt_files)}")