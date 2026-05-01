import { Source } from "@/lib/types";
import { FileText, Image, Table, BarChart } from "lucide-react";

interface Props {
  source: Source;
}

const typeIcon = (type: string) => {
  if (type === "table") return <Table className="w-3.5 h-3.5" />;
  if (type === "image" || type === "figure") return <Image className="w-3.5 h-3.5" />;
  if (type === "chart") return <BarChart className="w-3.5 h-3.5" />;
  return <FileText className="w-3.5 h-3.5" />;
};

const confidenceColor = (c: number) => {
  if (c >= 0.7) return "text-green-400 bg-green-400/10";
  if (c >= 0.4) return "text-yellow-400 bg-yellow-400/10";
  return "text-red-400 bg-red-400/10";
};

export default function SourceCard({ source }: Props) {
  return (
    <div className="bg-slate-900 rounded-xl p-3 border border-slate-700 text-xs">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 text-slate-400">
          {typeIcon(source.content_type)}
          <span className="font-medium text-slate-300 truncate max-w-[160px]">
            {source.filename}
          </span>
          <span className="text-slate-500">·</span>
          <span>Page {source.page_number}</span>
        </div>
        <span
          className={`px-2 py-0.5 rounded-full font-medium ${confidenceColor(source.confidence)}`}
        >
          {Math.round(source.confidence * 100)}%
        </span>
      </div>
      <p className="text-slate-400 line-clamp-2 leading-relaxed">{source.content_preview}</p>
    </div>
  );
}
