"""python -m backend.cli VIDEO --tables tables.json --output data/result.json"""
import argparse
import json
from pathlib import Path
from .analysis import analyze


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('video')
    parser.add_argument('--tables',required=True)
    parser.add_argument('--output',default='data/result.json')
    parser.add_argument('--annotated')
    parser.add_argument('--model',default='yolo11n.pt')
    parser.add_argument('--speed-factor',type=float,default=1.0)
    args = parser.parse_args()
    from .main import validate_tables
    from .layout import tables_for_video
    polygons = validate_tables(json.dumps(tables_for_video(args.tables,args.video)))
    output = Path(args.output)
    output.parent.mkdir(parents=True,exist_ok=True)
    if args.annotated:
        Path(args.annotated).parent.mkdir(parents=True,exist_ok=True)
    result = analyze(args.video,polygons,args.model,
        progress=lambda n,total: print(f'Frames {n}/{total}',flush=True),annotated_path=args.annotated,speed_factor=args.speed_factor)
    output.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(output.resolve())

if __name__ == '__main__':
    main()
