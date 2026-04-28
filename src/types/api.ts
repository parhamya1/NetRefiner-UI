export type UserRole = 'superadmin' | 'admin' | 'user'

export interface PagePermission {
  page_id: string
  can_view: boolean
  can_edit?: boolean
  can_delete?: boolean
  [key: string]: unknown
}

export interface ApiUser {
  id: string
  email: string
  full_name: string
  role: UserRole
  page_permissions: PagePermission[]
  is_active: boolean
  created_at: string
  updated_at: string
}



export type User = ApiUser

export interface UserCreatePayload {
  email: string
  full_name: string
  password: string
  role: UserRole
  is_active: boolean
  page_permissions?: PagePermission[]
}

export interface UserUpdatePayload {
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
}

export interface LoginInput {
  email: string
  password: string
}

export interface LoginResponse {
  access_token: string
  refresh_token: string
  token_type: 'bearer' | string
  user: ApiUser
}



export interface AssignedEntity {
  entity_id: string
  display_title: string
  display_type: 'table' | string
  filters_enabled: boolean
  sort_order: number
}

export interface Page {
  id: string
  title: string
  slug: string
  parent_id: string | null
  menu_order: number
  is_menu_visible: boolean
  assigned_entities: AssignedEntity[]
}

export interface PageCreatePayload {
  title: string
  slug: string
  parent_id: string | null
  menu_order: number
  is_menu_visible: boolean
  assigned_entities: AssignedEntity[]
}

export type PageUpdatePayload = PageCreatePayload

export interface EntitySummary {
  id: string
  name: string
  table_name?: string
  [key: string]: unknown
}
export interface EntityColumn {
  name: string
  label: string
  type?: string
  frontend_type: 'text' | 'number' | 'integer' | 'boolean' | 'date' | 'datetime' | string
  clickhouse_type: string
  is_filterable: boolean
  [key: string]: unknown
}

export interface Entity extends EntitySummary {
  table_name: string
  source_type?: 'manual' | 'csv' | 'clickhouse' | string
  columns?: EntityColumn[]
  created_at?: string
  updated_at?: string
}

export interface EntityCreatePayload {
  name: string
  table_name: string
  source_type?: 'manual' | 'csv' | 'clickhouse' | string
  columns: EntityColumn[]
}
export interface MenuTreeNode {
  id: string
  title: string
  slug: string
  parent_id: string | null
  menu_order: number
  is_menu_visible: boolean
  assigned_entities: EntityReference[]
  children: MenuTreeNode[]
}

export type EntityReference = EntitySummary

export interface PageSectionColumn {
  name: string
  label: string
  frontend_type: string
  clickhouse_type: string
  is_filterable: boolean
}

export interface CsvPreviewResponse {
  import_id?: string
  name?: string
  table_name?: string
  columns: EntityColumn[]
  [key: string]: unknown
}

export interface CsvConfirmPayload {
  import_id?: string
  name: string
  table_name?: string
  columns?: EntityColumn[]
  [key: string]: unknown
}

export interface ClickHouseDataSource {
  id: string
  name: string
  host: string
  port: number
  username: string
  secure: boolean
  [key: string]: unknown
}

export interface ClickHouseDataSourceCreatePayload {
  name: string
  host: string
  port: number
  username: string
  password: string
  secure: boolean
}

export interface ClickHouseDatabase {
  name: string
  [key: string]: unknown
}

export interface ClickHouseTable {
  name: string
  [key: string]: unknown
}

export interface ClickHouseSchemaColumn {
  name: string
  type: string
  [key: string]: unknown
}

export interface RegisterClickHouseTablePayload {
  data_source_id: string
  database: string
  table: string
  name: string
  table_name?: string
  columns?: EntityColumn[]
  [key: string]: unknown
}

export interface PageSectionConfig {
  entity_id: string
  entity_name: string
  table_name: string
  display_title: string
  display_type: string
  filters_enabled: boolean
  sort_order: number
  columns: PageSectionColumn[]
  data_endpoint: string
  query_endpoint: string
}

export interface PageConfig {
  id: string
  title: string
  slug: string
  parent_id: string | null
  sections: PageSectionConfig[]
}

export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'in'
  | 'not_in'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'

export interface EntityQueryFilter {
  column: string
  operator: FilterOperator | string
  value: string | number | boolean | null | Array<string | number | boolean>
}

export interface EntityQuerySort {
  column: string
  direction: 'asc' | 'desc'
}

export interface EntityRowsParams {
  page?: number
  page_size?: number
  [key: string]: string | number | boolean | undefined
}

export interface EntityQueryPayload {
  filters?: EntityQueryFilter[]
  sort?: EntityQuerySort
  page?: number
  page_size?: number
}

export interface EntityRowsResponse {
  entity: EntityReference
  columns: PageSectionColumn[]
  rows: Record<string, unknown>[]
  pagination: {
    page: number
    page_size: number
    returned: number
  }
}

export interface UserCreateInput {
  email: string
  full_name: string
  role: UserRole
  is_active?: boolean
  password?: string
  [key: string]: unknown
}

export interface UserUpdateInput {
  email?: string
  full_name?: string
  role?: UserRole
  is_active?: boolean
  [key: string]: unknown
}

export interface UpdateUserPasswordInput {
  password: string
}

export interface UpdateMyPasswordInput {
  current_password: string
  new_password: string
}

export interface UpdateUserPagePermissionsInput {
  page_permissions: PagePermission[]
}
