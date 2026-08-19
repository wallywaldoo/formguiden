import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function MetricCard({
  title,
  value,
  caption,
  explanation,
  className,
}: {
  title: string;
  value: string;
  caption?: string;
  explanation?: string;
  className?: string;
}) {
  return (
    <Card className={cn("border-white/50", className)}>
      <CardHeader className="gap-3">
        <CardDescription className="text-[0.95rem] font-medium tracking-[-0.01em]">
          {title}
        </CardDescription>
        <CardTitle className="text-[1.9rem] font-semibold tracking-[-0.045em] md:text-[2.2rem]">
          {value}
        </CardTitle>
      </CardHeader>
      {(caption || explanation) && (
        <CardContent>
          <div className="flex items-start justify-between gap-3">
            {caption ? (
              <p className="text-[0.95rem] leading-6 text-muted-foreground">
                {caption}
              </p>
            ) : null}
            {explanation ? (
              <Tooltip>
                <TooltipTrigger className="rounded-full border border-white/45 bg-white/55 px-2.5 py-1 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground">
                  Formel
                </TooltipTrigger>
                <TooltipContent>{explanation}</TooltipContent>
              </Tooltip>
            ) : null}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
