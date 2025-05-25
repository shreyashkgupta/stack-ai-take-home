# Stack AI File Picker

A modern file picker interface for Google Drive integration with knowledge base indexing capabilities. Built as part of the Stack AI take-home assessment.

## 🚀 Live Demo

**Try it now:** [https://stack-ai-take-home-80voaep0t-shreyashkguptas-projects.vercel.app](https://stack-ai-take-home-80voaep0t-shreyashkguptas-projects.vercel.app)

## 📋 Project Overview

This application provides a file management interface similar to Finder (macOS) or File Explorer (Windows) for Google Drive files. Users can browse, select, and index files into knowledge bases while maintaining a clean, intuitive user experience.

### Key Features

- **📁 File Browser**: Navigate through Google Drive folders with hierarchical accordion-style expansion
- **🔍 Search & Filter**: Real-time search by filename with debounced input
- **📊 Sorting**: Sort files by name, modification date, or size
- **✅ Selection Management**: Multi-select files with bulk operations
- **🗂️ Knowledge Base Integration**: Index/de-index files for knowledge base creation
- **⚡ Performance Optimized**: SWR caching, optimistic updates, and proper loading states

## 🛠️ Tech Stack

- **Framework**: Next.js 15.1.8 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **Data Fetching**: SWR for caching and state management
- **State Management**: React hooks + SWR (no external state management needed)
- **UI Components**: Radix UI primitives via shadcn/ui
- **Icons**: Lucide React
- **Notifications**: Sonner (toast notifications)
- **Table Management**: TanStack Table v8

## 🏃‍♂️ Running Locally

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/shreyashkgupta/stack-ai-take-home.git
cd stack-ai-take-home/frontend
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**

Create a `.env.local` file in the frontend directory:

```env
# Authentication & API Configuration
NEXT_PUBLIC_SUPABASE_AUTH_URL=https://sb.stack-ai.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNiLXN0YWNrLWFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ5NzI4MDAsImV4cCI6MjA1MDU0ODgwMH0.example
NEXT_PUBLIC_DEFAULT_EMAIL=stackaitest@gmail.com
NEXT_PUBLIC_DEFAULT_PASSWORD=!z4ZnxkyLYs#vR
NEXT_PUBLIC_API_URL=https://api.stack-ai.com
NEXT_PUBLIC_DEFAULT_CONNECTION_ID=e171b021-8c00-4c3f-8a93-396095414f57
```

> **Note**: These credentials are provided in the take-home instructions and are safe to include as they're specifically created for this assessment.

4. **Run the development server**
```bash
npm run dev
```

5. **Open your browser**
Navigate to [http://localhost:3000](http://localhost:3000)

### Build for Production

```bash
npm run build
npm run start
```

## 🏗️ Project Structure
```
frontend/
├── app/                    # Next.js App Router
│   ├── globals.css         # Global styles and CSS variables
│   ├── layout.tsx          # Root layout with providers
│   └── page.tsx            # Main application page
├── components/
│   ├── file-picker/        # Core file picker components
│   │   ├── index.tsx       # Main FilePicker component
│   │   ├── file-table.tsx  # Data table with sorting/filtering
│   │   ├── file-icon.tsx   # File type icons
│   │   └── table-header.tsx # Sortable column headers
│   └── ui/                 # Reusable UI components (shadcn/ui)
├── lib/
│   ├── api.ts              # API client and endpoints
│   ├── auth.ts             # Authentication utilities
│   ├── hooks.ts            # Custom React hooks
│   └── utils.ts            # Utility functions
├── providers/
│   └── auth-provider.tsx   # Authentication context
├── types/
│   ├── api.ts              # API response types
│   └── auth.ts             # Authentication types
└── public/                 # Static assets
```

## 🎯 Technical Choices & Architecture

### 1. **Next.js App Router**
- **Why**: Latest Next.js features, better performance, and improved developer experience
- **Benefits**: Server components, improved routing, and better SEO capabilities

### 2. **SWR for Data Fetching**
- **Why**: Excellent caching, background revalidation, and optimistic updates
- **Benefits**: Automatic request deduplication, focus revalidation, and offline support
- **Implementation**: Custom hooks in `lib/hooks.ts` for resource management

### 3. **Component Architecture**
- **Hierarchical Design**: `FilePicker` → `FileTable` → `TableHeader` + individual cells
- **Separation of Concerns**: Each component has a single responsibility
- **Reusability**: UI components are abstracted and reusable

### 4. **State Management Strategy**
- **Local State**: React hooks for component-specific state
- **Server State**: SWR for API data caching and synchronization
- **Global State**: Context API for authentication (minimal global state)

### 5. **Performance Optimizations**
- **Memoization**: `useCallback` and `useMemo` for expensive operations
- **Debounced Search**: 300ms debounce for search input
- **Optimistic Updates**: Immediate UI feedback before API confirmation
- **Efficient Re-renders**: Careful dependency management to minimize unnecessary updates

### 6. **User Experience Decisions**

#### **Accordion-Style Navigation**
- **Problem**: Original nested table navigation was confusing
- **Solution**: Expandable folders with indentation to show hierarchy
- **Benefit**: Users can see file structure at a glance

#### **Smart Selection Logic**
- **Folder Selection**: Automatically selects all files within folders
- **File-Only Indexing**: Only files can be indexed, not folders
- **Visual Feedback**: Clear indication of selection state and indexing status

#### **Error Handling & Feedback**
- **Toast Notifications**: Immediate feedback for all user actions
- **Error Recovery**: Graceful handling of API failures
- **Loading States**: Professional loading indicators for ongoing operations

### 7. **API Integration**
- **RESTful Design**: Clean API client with typed responses
- **Authentication**: JWT token management with automatic refresh
- **Error Handling**: Comprehensive error handling with user-friendly messages

### 8. **Styling Approach**
- **Tailwind CSS**: Utility-first CSS for rapid development
- **shadcn/ui**: High-quality, accessible components
- **Design System**: Consistent spacing, colors, and typography
- **Desktop-First**: Optimized for desktop file management workflows

## 🔧 Key Features Implementation

### **File Browser**
- Hierarchical folder structure with accordion expansion
- Real-time loading of folder contents
- Breadcrumb navigation (ready for implementation)

### **Search & Filtering**
- Debounced search input (300ms delay)
- Real-time filtering of visible results
- Search across file names and paths

### **Selection Management**
- Multi-select with checkboxes
- Bulk operations (index/de-index multiple files)
- Smart folder selection (selects all contained files)

### **Knowledge Base Integration**
- File indexing with progress tracking
- Status indicators (indexed/pending/failed)
- Polling for indexing completion
- De-indexing capabilities

## 🚀 Deployment

The application is deployed on Vercel with automatic deployments from the main branch.

**Live URL**: [https://stack-ai-take-home-os7gsmerr-shreyashkguptas-projects.vercel.app](https://stack-ai-take-home-os7gsmerr-shreyashkguptas-projects.vercel.app)

### Environment Variables in Production
All required environment variables are configured in the Vercel dashboard for the production deployment.

## 🧪 Development Notes

### **Code Quality Practices**
- **TypeScript**: Full type safety throughout the application
- **Custom Hooks**: Reusable logic abstracted into hooks
- **Component Composition**: Small, focused components
- **Error Boundaries**: Graceful error handling
- **Performance**: Optimized re-renders and API calls
