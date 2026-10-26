#!/usr/bin/env python3
"""Count defined measures of a UTF-8 file without changing it or using a network."""
import argparse
import json
from pathlib import Path

def count_text(path):
    path = Path(path)
    if path.stat().st_size > 2_000_000:
        raise ValueError('File exceeds the two-megabyte demonstration limit')
    raw = path.read_bytes()
    text = raw.decode('utf-8')
    return {'code_points': len(text), 'utf8_bytes': len(text.encode('utf-8')),
            'utf16_code_units': len(text.encode('utf-16-le')) // 2,
            'whitespace_tokens': len(text.split()), 'line_feed_count': text.count('\n'),
            'carriage_return_count': text.count('\r')}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('utf8_file')
    args = parser.parse_args()
    try:
        result = count_text(args.utf8_file)
    except (ValueError, OSError) as exc:
        parser.exit(2, 'Input error: ' + str(exc) + '\n')
    print(json.dumps(result, indent=2))

if __name__ == '__main__':
    main()
