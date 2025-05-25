"use client";

import { useState, useMemo } from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Resource } from "@/types/api";
import { FileTypeIcon } from "./file-icon";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, MoreHorizontal, Search, Loader2, CheckCircle2, AlertCircle, Clock, FileText, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { DataTableColumnHeader } from "@/components/file-picker/table-header";

interface HierarchicalResource extends Resource {
  depth: number;
  isExpanded?: boolean;
  parentId?: string;
}

interface FileTableProps {
  data: HierarchicalResource[];
  isLoading: boolean;
  onNavigate: (resource: Resource) => void;
  onSelect: (resource: Resource) => void;
  onIndex?: (resource: Resource) => void;
  onDeIndex?: (resource: Resource) => void;
  selectedResources: Record<string, boolean>;
  onPrefetch?: (resourceId: string) => void;
  indexingStatus?: Record<string, string>;
  loadingFolders?: Set<string>;
}

function getDisplayName(fullPath: string): string {
  const parts = fullPath.split('/');
  return parts[parts.length - 1] || fullPath;
}

function sortHierarchicalData(
  originalData: HierarchicalResource[],
  sortingState: SortingState
): HierarchicalResource[] {
  if (!sortingState || sortingState.length === 0) {
    return originalData;
  }

  const { id: sortBy, desc: sortDesc } = sortingState[0];

  const getValue = (resource: HierarchicalResource, columnId: string) => {
    if (columnId === "inode_path.path") {
      return getDisplayName(resource.inode_path.path).toLowerCase();
    }
    if (columnId === "modified_at") {
      return new Date(resource.modified_at).getTime();
    }
    if (columnId === "size") {
      if (resource.inode_type === "directory") return -1;
      return resource.size as number;
    }
    if (columnId === "status") {
      return resource.status || '';
    }
    return resource[columnId as keyof HierarchicalResource];
  };

  const resourcesById: Record<string, HierarchicalResource> = {};
  const childrenByParentId: Record<string, string[]> = {};
  const rootItemIds: string[] = [];

  originalData.forEach(item => {
    resourcesById[item.resource_id] = item;
    const parentId = item.parentId;
    if (parentId && originalData.some(p => p.resource_id === parentId)) {
      if (!childrenByParentId[parentId]) {
        childrenByParentId[parentId] = [];
      }
      childrenByParentId[parentId].push(item.resource_id);
    } else {
      rootItemIds.push(item.resource_id);
    }
  });

  const recursiveSortAndFlatten = (currentItemIds: string[]): HierarchicalResource[] => {
    const itemsToSort = currentItemIds.map(id => resourcesById[id]).filter(item => !!item);


    itemsToSort.sort((a, b) => {
      const valA = getValue(a, sortBy);
      const valB = getValue(b, sortBy);
      let comparison = 0;

      const aIsNull = valA === null || valA === undefined;
      const bIsNull = valB === null || valB === undefined;

      if (aIsNull && bIsNull) {
        comparison = 0;
      } else if (aIsNull) {
        comparison = 1; 
      } else if (bIsNull) {
        comparison = -1;
      } else {
        if (typeof valA === 'number' && typeof valB === 'number') {
          comparison = valA - valB;
        } else if (typeof valA === 'string' && typeof valB === 'string') {
          comparison = valA.localeCompare(valB);
        } else {
          if (valA < valB) comparison = -1;
          else if (valA > valB) comparison = 1;
        }
      }
      
      if (comparison === 0 && sortBy !== "inode_path.path") {
        const nameA = getDisplayName(a.inode_path.path).toLowerCase();
        const nameB = getDisplayName(b.inode_path.path).toLowerCase();
        comparison = nameA.localeCompare(nameB);
      }
      
      return sortDesc ? comparison * -1 : comparison;
    });

    const result: HierarchicalResource[] = [];
    itemsToSort.forEach(item => {
      result.push(item);
      if (item.inode_type === "directory" && childrenByParentId[item.resource_id]) {
        result.push(...recursiveSortAndFlatten(childrenByParentId[item.resource_id]));
      }
    });
    return result;
  };

  return recursiveSortAndFlatten(rootItemIds);
}

export function FileTable({
  data,
  isLoading,
  onNavigate,
  onSelect,
  onIndex,
  onDeIndex,
  selectedResources,
  onPrefetch,
  indexingStatus = {},
  loadingFolders = new Set(),
}: FileTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState<string>("");

  const resourcesMap = data.reduce((acc, resource) => {
    acc[resource.resource_id] = resource;
    return acc;
  }, {} as Record<string, Resource>);

  const handleRowSelectionChange = (id: string) => {
    if (resourcesMap[id]) {
      onSelect(resourcesMap[id]);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    const currentRows = table.getFilteredRowModel().rows.map(row => row.original);
    if (checked) {
      currentRows.forEach(resource => {
        if (!selectedResources[resource.resource_id]) {
          onSelect(resource);
        }
      });
    } else {
      currentRows.forEach(resource => {
        if (selectedResources[resource.resource_id]) {
          onSelect(resource);
        }
      });
    }
  };
  
  const processedData = useMemo(() => {
    return sortHierarchicalData(data, sorting);
  }, [data, sorting]);

  const columns: ColumnDef<HierarchicalResource>[] = [
    {
      id: "select",
      header: () => {
        const currentRows = table.getFilteredRowModel().rows.map(row => row.original);
        const allVisibleSelected = currentRows.length > 0 && currentRows.every(resource => selectedResources[resource.resource_id]);
        return (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={allVisibleSelected}
              onCheckedChange={handleSelectAll}
              aria-label="Select all"
            />
          </div>
        );
      },
      cell: ({ row }) => {
        const resource = row.original;
        return (
          <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={!!selectedResources[resource.resource_id]}
              onCheckedChange={() => {
                handleRowSelectionChange(resource.resource_id);
              }}
              aria-label="Select row"
            />
          </div>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "inode_path.path",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
      cell: ({ row }) => {
        const resource = row.original;
        const isDirectory = resource.inode_type === "directory";
        const isExpanded = resource.isExpanded;
        const isLoading = loadingFolders.has(resource.resource_id);
        const indentationLevel = resource.depth * 20; // 20px per level
        const displayName = getDisplayName(resource.inode_path.path);

        return (
          <div
            className="flex items-center gap-2 cursor-pointer"
            style={{ paddingLeft: `${indentationLevel}px` }}
            onClick={() => onNavigate(resource)}
            onMouseEnter={() => {
              if (isDirectory && onPrefetch) {
                onPrefetch(resource.resource_id);
              }
            }}
          >
            {isDirectory && (
              <div className="flex items-center justify-center w-4 h-4">
                {isLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : isExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </div>
            )}

            <FileTypeIcon
              type={isDirectory ? "directory" : "file"}
              mimeType={resource.content_mime}
            />

            <span className={isDirectory ? "font-medium" : ""}>
              {displayName}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "modified_at",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Modified" />
      ),
      cell: ({ row }) => {
        const date = new Date(row.getValue("modified_at") as string);
        return (
          <div className="text-sm text-muted-foreground">
            {formatDistanceToNow(date, { addSuffix: true })}
          </div>
        );
      },
    },
    {
      accessorKey: "size",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Size" />
      ),
      cell: ({ row }) => {
        const resource = row.original;
        if (resource.inode_type === "directory") return "—";

        const size = resource.size as number;
        if (!size) return "—";

        const formatFileSize = (bytes: number): string => {
          if (bytes < 1024) return `${bytes} B`;
          if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
          if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
          return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
        };

        return <div>{formatFileSize(size)}</div>;
      },
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const resource = row.original;

        if (resource.inode_type === "directory") return null;

        const getStatusDisplay = (resource: Resource, indexingStatusForResource?: string) => {
          const status = indexingStatusForResource || resource.status || 'resource';

          switch (status) {
            case 'indexed':
            case 'completed':
              return {
                label: 'Indexed',
                variant: 'success' as const,
                icon: CheckCircle2,
                canDeIndex: true,
                canIndex: false,
                className: 'bg-green-100 text-green-800 hover:bg-green-100 border-green-200'
              };
            case 'pending':
            case 'processing':
              return {
                label: 'Indexing...',
                variant: 'warning' as const,
                icon: Loader2,
                canDeIndex: false,
                canIndex: false,
                spinning: true,
                className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-yellow-200'
              };
            case 'de-indexing':
              return {
                label: 'De-indexing...',
                variant: 'warning' as const,
                icon: Loader2,
                canDeIndex: false,
                canIndex: false,
                spinning: true,
                className: 'bg-orange-100 text-orange-800 hover:bg-orange-100 border-orange-200'
              };
            case 'error':
            case 'failed':
              return {
                label: 'Error',
                variant: 'destructive' as const,
                icon: AlertCircle,
                canDeIndex: false,
                canIndex: true,
                className: 'bg-red-100 text-red-800 hover:bg-red-100 border-red-200'
              };
            case 'timeout':
              return {
                label: 'Timeout',
                variant: 'destructive' as const,
                icon: Clock,
                canDeIndex: false,
                canIndex: true,
                className: 'bg-red-100 text-red-800 hover:bg-red-100 border-red-200'
              };
            case 'resource':
            default:
              return {
                label: 'Unindexed',
                variant: 'secondary' as const,
                icon: FileText,
                canDeIndex: false,
                canIndex: true,
                className: 'bg-gray-100 text-gray-800 hover:bg-gray-100 border-gray-200'
              };
          }
        };

        const statusDisplay = getStatusDisplay(resource, indexingStatus?.[resource.resource_id]);
        const IconComponent = statusDisplay.icon;

        return (
          <div>
            <Badge
              variant={statusDisplay.variant as "default" | "outline" | "secondary" | "destructive" | null}
              className={`inline-flex items-center gap-1 px-2 py-1 ${statusDisplay.className || ''}`}
            >
              <IconComponent
                className={`w-3 h-3 ${statusDisplay.spinning ? "animate-spin" : ""}`}
              />
              {statusDisplay.label}
            </Badge>
          </div>
        );
      },
      enableSorting: true,
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const resource = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              {resource.inode_type === "directory" ? (
                <DropdownMenuItem onClick={() => onNavigate(resource)}>
                  Open Folder
                </DropdownMenuItem>
              ) : (
                <>
                  <DropdownMenuItem onClick={() => onSelect(resource)}>
                    Select
                  </DropdownMenuItem>
                  {onIndex && (
                    <DropdownMenuItem onClick={() => onIndex(resource)}>
                      Index
                    </DropdownMenuItem>
                  )}
                  {onDeIndex && (
                    <DropdownMenuItem onClick={() => onDeIndex(resource)}>
                      De-Index
                    </DropdownMenuItem>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const table = useReactTable({
    data: processedData,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    manualSorting: true,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
    },
    getRowId: (row) => row.resource_id,
  });

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search files..."
              value={globalFilter ?? ""}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-8 w-[250px] md:w-[300px]"
            />
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-auto">
              Columns <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }
                  >
                    {column.id === "inode_path.path" ? "Name" :
                      column.id === "modified_at" ? "Modified" :
                        column.id === "size" ? "Size" :
                          column.id === "status" ? "Status" : column.id}
                  </DropdownMenuCheckboxItem>
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="rounded-md border flex-1 flex flex-col">
        <Table className="border-b">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="text-left font-medium bg-background"
                    style={{
                      width: header.id === 'select' ? '60px' :
                        header.id === 'status' ? '120px' :
                          header.id === 'modified_at' ? '150px' :
                            header.id === 'size' ? '100px' :
                              header.id === 'actions' ? '70px' : 'auto'
                    }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
        </Table>
        
        <div className="overflow-auto h-[350px]">
          <Table>
            <TableBody>
              {table.getRowModel().rows.length > 0 ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={selectedResources[row.original.resource_id] ? "selected" : undefined}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        style={{
                          width: cell.column.id === 'select' ? '60px' :
                            cell.column.id === 'status' ? '120px' :
                              cell.column.id === 'modified_at' ? '150px' :
                                cell.column.id === 'size' ? '100px' :
                                  cell.column.id === 'actions' ? '70px' : 'auto'
                        }}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    {isLoading ? "Loading..." : "No results found."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
