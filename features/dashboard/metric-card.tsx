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
    <Card className={cn(className)}>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-4xl font-semibold tracking-tight">
          {value}
        </CardTitle>
      </CardHeader>
      {(caption || explanation) && (
        <CardContent>
          <div className="flex items-start justify-between gap-3">
            {caption ? (
              <p className="text-sm text-muted-foreground">{caption}</p>
            ) : null}
            {explanation ? (
              <Tooltip>
                <TooltipTrigger className="text-xs text-muted-foreground underline-offset-4 hover:underline">
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
