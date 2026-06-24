import os
import json

def main():
    src_path = r"c:\Users\richi\.antigravity\OnomaDict\data\onomatopoeia_dictionary.json"
    dst_dir = r"c:\Users\richi\.antigravity\onomapet00"
    dst_path = os.path.join(dst_dir, "onomatopoeia_dictionary.js")

    if not os.path.exists(dst_dir):
        os.makedirs(dst_dir)

    print(f"Reading from {src_path}...")
    with open(src_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    print(f"Writing to {dst_path}...")
    with open(dst_path, "w", encoding="utf-8") as f:
        f.write("// OnomaDict dictionary wrapped as a JS variable for local standalone execution\n")
        f.write("const ONOMA_DICT = ")
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write(";\n")
    
    print("Conversion complete!")

if __name__ == "__main__":
    main()
