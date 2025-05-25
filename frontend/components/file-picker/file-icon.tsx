"use client";

import {
  FileIcon,
  FileTextIcon,
  FileImageIcon,
  FileVideoIcon,
  FileAudioIcon,
  FileJsonIcon,
  FileCodeIcon,
  FolderIcon,
  FolderOpenIcon,
  FileArchiveIcon
} from "lucide-react";
import { cn } from "@/lib/utils";

export type FileIconProps = {
  type: 'file' | 'directory';
  mimeType?: string;
  isOpen?: boolean;
  className?: string;
  size?: number;
};

const mimeTypeMap: Record<string, { icon: typeof FileIcon; color: string }> = {
  image: { icon: FileImageIcon, color: "text-green-600 dark:text-green-400" },
  video: { icon: FileVideoIcon, color: "text-purple-600 dark:text-purple-400" },
  audio: { icon: FileAudioIcon, color: "text-pink-600 dark:text-pink-400" },
  pdf: { icon: FileTextIcon, color: "text-red-600 dark:text-red-400" },
  json: { icon: FileJsonIcon, color: "text-yellow-600 dark:text-yellow-400" },
  code: { icon: FileCodeIcon, color: "text-cyan-600 dark:text-cyan-400" },
  text: { icon: FileTextIcon, color: "text-gray-600 dark:text-gray-400" },
  archive: { icon: FileArchiveIcon, color: "text-orange-600 dark:text-orange-400" },
};

function getIconTypeFromMime(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType === 'application/json') return 'json';
  if (mimeType.includes('javascript') || mimeType.includes('typescript') ||
    mimeType.includes('html') || mimeType.includes('css')) return 'code';
  if (mimeType.startsWith('text/') || mimeType.includes('document')) return 'text';
  if (mimeType.includes('zip') || mimeType.includes('tar') ||
    mimeType.includes('compressed')) return 'archive';

  return 'default';
}

export function FileTypeIcon({
  type,
  mimeType = "",
  isOpen = false,
  className,
  size = 16
}: FileIconProps) {
  if (type === 'directory') {
    const iconClassName = cn(
      "shrink-0",
      "text-amber-500 dark:text-amber-400",
      className
    );

    return isOpen
      ? <FolderOpenIcon className={iconClassName} size={size} />
      : <FolderIcon className={iconClassName} size={size} />;
  }

  const iconType = mimeType ? getIconTypeFromMime(mimeType) : 'default';
  const { icon: Icon, color } = mimeTypeMap[iconType] || {
    icon: FileIcon,
    color: "text-blue-600 dark:text-blue-400"
  };

  const iconClassName = cn("shrink-0", color, className);

  return <Icon className={iconClassName} size={size} />;
}
