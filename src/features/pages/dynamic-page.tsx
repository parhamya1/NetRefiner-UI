import { useMemo } from 'react'
import { AxiosError } from 'axios'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, Ban, FileX } from 'lucide-react'
import { getEntityRows } from '@/lib/api/entities'
import { getPageBySlug } from '@/lib/api/pages'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { type PageSectionConfig } from '@/types/api'

type DynamicPageProps = {
  slug: string
}

function getPageErrorState(error: unknown) {
  if (!(error instanceof AxiosError)) return 'general' as const

  if (error.response?.status === 403) return 'forbidden' as const
  if (error.response?.status === 404) return 'not_found' as const

  return 'general' as const
}

function SectionRowsTable({
  section,
}: {
  section: PageSectionConfig
}) {
  const rowsQuery = useQuery({
    queryKey: ['pages', 'section-rows', section.entity_id],
    queryFn: () =>
      getEntityRows(section.entity_id, {
        page: 1,
        page_size: 50,
      }),
  })

  if (rowsQuery.isLoading) {
    return (
      <div className='space-y-2'>
        <Skeleton className='h-8 w-full' />
        <Skeleton className='h-8 w-full' />
        <Skeleton className='h-8 w-full' />
      </div>
    )
  }

  if (rowsQuery.isError) {
    return (
      <Alert variant='destructive'>
        <AlertCircle />
        <AlertTitle>Unable to load section data</AlertTitle>
        <AlertDescription>
          We could not load rows for <strong>{section.display_title}</strong>.
        </AlertDescription>
      </Alert>
    )
  }

  const rowsData = rowsQuery.data
  if (!rowsData) {
    return null
  }

  const resolvedColumns =
    rowsData.columns.length > 0 ? rowsData.columns : section.columns

  if (resolvedColumns.length === 0) {
    return (
      <Alert>
        <AlertCircle />
        <AlertTitle>No columns configured</AlertTitle>
        <AlertDescription>
          This section has no columns available to display.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className='overflow-hidden rounded-md border'>
      <Table>
        <TableHeader>
          <TableRow>
            {resolvedColumns.map((column) => (
              <TableHead key={`${section.entity_id}-${column.name}`}>
                {column.label || column.name}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rowsData.rows.length > 0 ? (
            rowsData.rows.map((row, rowIndex) => (
              <TableRow key={`${section.entity_id}-row-${rowIndex}`}>
                {resolvedColumns.map((column) => (
                  <TableCell key={`${section.entity_id}-${rowIndex}-${column.name}`}>
                    {String(row[column.name] ?? '-')}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={resolvedColumns.length}
                className='h-24 text-center text-muted-foreground'
              >
                No rows available.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

export function DynamicPage({ slug }: DynamicPageProps) {
  const pageQuery = useQuery({
    queryKey: ['pages', 'by-slug', slug],
    queryFn: () => getPageBySlug(slug),
    retry: false,
  })

  const sections = useMemo(
    () => [...(pageQuery.data?.sections ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    [pageQuery.data?.sections]
  )


  const pageErrorState = pageQuery.error ? getPageErrorState(pageQuery.error) : null

  return (
    <>
      <Header fixed>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        {pageQuery.isLoading ? (
          <>
            <Skeleton className='h-8 w-56' />
            <Skeleton className='h-44 w-full' />
            <Skeleton className='h-44 w-full' />
          </>
        ) : pageErrorState === 'forbidden' ? (
          <Alert variant='destructive'>
            <Ban />
            <AlertTitle>Access denied</AlertTitle>
            <AlertDescription>
              You do not have permission to view this page.
            </AlertDescription>
          </Alert>
        ) : pageErrorState === 'not_found' ? (
          <Alert>
            <FileX />
            <AlertTitle>Page not found</AlertTitle>
            <AlertDescription>
              The requested page could not be found.
            </AlertDescription>
          </Alert>
        ) : pageErrorState === 'general' ? (
          <Alert variant='destructive'>
            <AlertCircle />
            <AlertTitle>Unable to load page</AlertTitle>
            <AlertDescription>
              Something went wrong while loading this page.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div>
              <h2 className='text-2xl font-bold tracking-tight'>
                {pageQuery.data?.title}
              </h2>
              <p className='text-muted-foreground'>
                Dynamic page: <span className='font-medium'>{pageQuery.data?.slug}</span>
              </p>
            </div>

            {sections.length === 0 ? (
              <Alert>
                <AlertCircle />
                <AlertTitle>No sections configured</AlertTitle>
                <AlertDescription>
                  This page does not have any sections yet.
                </AlertDescription>
              </Alert>
            ) : (
              sections.map((section) => (
                <Card key={section.entity_id}>
                  <CardHeader>
                    <CardTitle>{section.display_title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <SectionRowsTable section={section} />
                  </CardContent>
                </Card>
              ))
            )}
          </>
        )}
      </Main>
    </>
  )
}
