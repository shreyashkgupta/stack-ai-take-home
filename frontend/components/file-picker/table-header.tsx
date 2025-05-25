"use client";

import { Column } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { 
  ArrowDownIcon, 
  ArrowUpIcon, 
  ChevronsUpDownIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DataTableColumnHeaderProps<TData, TValue> {
  column: Column<TData, TValue>;
  title: string;
  className?: string;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <div className={cn("font-medium", className)}>{title}</div>;
  }

  return (
    <div className={cn("flex items-center", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 font-medium -ml-3 data-[state=open]:bg-accent"
          >
            <span>{title}</span>
            {column.getIsSorted() === "desc" ? (
              <ArrowDownIcon className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "asc" ? (
              <ArrowUpIcon className="ml-2 h-4 w-4" />
            ) : (
              <ChevronsUpDownIcon className="ml-2 h-4 w-4 opacity-50" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem
            onClick={() => column.toggleSorting(false)}
            className={cn(
              "cursor-pointer",
              column.getIsSorted() === "asc" && "bg-accent"
            )}
          >
            <ArrowUpIcon className="mr-2 h-3.5 w-3.5" />
            <span>Sort ascending</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => column.toggleSorting(true)}
            className={cn(
              "cursor-pointer",
              column.getIsSorted() === "desc" && "bg-accent"
            )}
          >
            <ArrowDownIcon className="mr-2 h-3.5 w-3.5" />
            <span>Sort descending</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => column.clearSorting()}
            className="cursor-pointer"
          >
            <ChevronsUpDownIcon className="mr-2 h-3.5 w-3.5" />
            <span>Reset sort</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
