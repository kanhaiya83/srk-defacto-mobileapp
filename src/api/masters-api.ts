import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import request from './request';

export interface Agent {
  _id: string;
  id: string;
  agent_name: string;
  office_address: string;
  aadhaar_no: string;
  pan_no: string;
  phone_no: string;
  mobile_no: string;
  email: string;
  bank_name: string;
  account_no: string;
  branch: string;
  ifsc_code: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BagType {
  _id: string;
  id: string;
  bag_type_name: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BagGrade {
  _id: string;
  id: string;
  title: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BagTypeConfiguration {
  _id: string;
  id: string;
  bag_type_id: string;
  bag_grade_id: string;
  bag_size_kg: number;
  bag_weight: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Commodity {
  _id: string;
  id: string;
  commodity_name: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Company {
  _id: string;
  id: string;
  company_name: string;
  slug: string;
  office_address: string;
  factory_address: string;
  date_of_establishment: Date;
  gst_no: string;
  pan_no: string;
  challan_prefix: string;
  challan_series: number;
  email: string;
  mobile_no: string[];
  bank_name: string;
  bank_account_no: string;
  bank_branch: string;
  ifsc_code: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CompanyGroup {
  _id: string;
  id: string;
  group_name: string;
  company_ids: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Grade {
  _id: string;
  id: string;
  grade_name: string;
  commodity_id: string;
  rate?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SourceLocation {
  _id: string;
  id: string;
  source_location_name: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Vendor {
  _id: string;
  id: string;
  category: string[];
  vendor_name: string;
  pan_no: string;
  gst_no: string;
  office_address: string;
  factory_address: string;
  other_addresses: { label: string; address: string }[];
  state: string;
  contact_details: { person: string; mobile_no: string }[];
  landline_no: string;
  email: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface VendorBankDetails {
  _id: string;
  id: string;
  vendor_id: string;
  banks: {
    bank_name: string;
    branch: string;
    account_no: string;
    ifsc_code: string;
  }[];
  createdAt?: string;
  updatedAt?: string;
}

export interface WarehouseLocation {
  _id: string;
  id: string;
  location_name: string;
  sub_locations: { id: string; name: string }[];
  createdAt?: string;
  updatedAt?: string;
}

export interface WeighBridge {
  _id: string;
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Machine {
  _id: string;
  id: string;
  machine_name: string;
  remark?: string;
  locked_in_lot?: {
    _id: string;
    lot_no: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

const AGENTS = 'agents';
const BAG_TYPES = 'bag-types';
const BAG_GRADES = 'bag-grades';
const BAG_TYPE_CONFIGURATIONS = 'bag-type-configurations';
const COMMODITIES = 'commodities';
const COMPANIES = 'companies';
const COMPANY_GROUPS = 'company-groups';
const GRADES = 'grades';
const SOURCE_LOCATIONS = 'source-locations';
const VENDORS = 'vendors';
const VENDOR_BANK_DETAILS = 'vendor-bank-details';
const WAREHOUSE_LOCATIONS = 'warehouse-locations';
const MACHINES = 'machines';
const WEIGH_BRIDGES = 'weigh-bridges';

export const useAgents = () => {
  return useQuery({
    queryKey: [AGENTS],
    queryFn: () => request.get<Agent[]>('/api/agents').then(res => res.data.map(item => ({ ...item, id: item._id }))),
  });
};

export const useAgent = (id: string) => {
  return useQuery({
    queryKey: [AGENTS, id],
    queryFn: () => request.get<Agent>(`/api/agents/${id}`).then(res => ({ ...res.data, id: res.data._id })),
    enabled: !!id,
  });
};

export const useCreateAgent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Agent) => request.post<Agent>('/api/agents', data).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [AGENTS] }),
  });
};

export const useUpdateAgent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Agent> }) => request.put<Agent>(`/api/agents/${id}`, data).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [AGENTS] }),
  });
};

export const useDeleteAgent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request.delete(`/api/agents/${id}`).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [AGENTS] }),
  });
};

export const useBagTypes = () => {
  return useQuery({
    queryKey: [BAG_TYPES],
    queryFn: () => request.get<BagType[]>('/api/bag-types').then(res => res.data.map(item => ({ ...item, id: item._id }))),
  });
};

export const useBagType = (id: string) => {
  return useQuery({
    queryKey: [BAG_TYPES, id],
    queryFn: () => request.get<BagType>(`/api/bag-types/${id}`).then(res => ({ ...res.data, id: res.data._id })),
    enabled: !!id,
  });
};

export const useCreateBagType = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BagType) => request.post<BagType>('/api/bag-types', data).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [BAG_TYPES] }),
  });
};

export const useUpdateBagType = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<BagType> }) => request.put<BagType>(`/api/bag-types/${id}`, data).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [BAG_TYPES] }),
  });
};

export const useDeleteBagType = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request.delete(`/api/bag-types/${id}`).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [BAG_TYPES] }),
  });
};

export const useBagGrades = () => {
  return useQuery({
    queryKey: [BAG_GRADES],
    queryFn: () => request.get<BagGrade[]>('/api/bag-grades').then(res => res.data.map(item => ({ ...item, id: item._id }))),
  });
};

export const useBagGrade = (id: string) => {
  return useQuery({
    queryKey: [BAG_GRADES, id],
    queryFn: () => request.get<BagGrade>(`/api/bag-grades/${id}`).then(res => ({ ...res.data, id: res.data._id })),
    enabled: !!id,
  });
};

export const useCreateBagGrade = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BagGrade) => request.post<BagGrade>('/api/bag-grades', data).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [BAG_GRADES] }),
  });
};

export const useUpdateBagGrade = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<BagGrade> }) => request.put<BagGrade>(`/api/bag-grades/${id}`, data).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [BAG_GRADES] }),
  });
};

export const useDeleteBagGrade = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request.delete(`/api/bag-grades/${id}`).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [BAG_GRADES] }),
  });
};

export const useBagTypeConfigurations = () => {
  return useQuery({
    queryKey: [BAG_TYPE_CONFIGURATIONS],
    queryFn: () => request.get<BagTypeConfiguration[]>('/api/bag-type-configurations').then(res => res.data.map(item => ({ ...item, id: item._id }))),
  });
};

export const useBagTypeConfiguration = (id: string) => {
  return useQuery({
    queryKey: [BAG_TYPE_CONFIGURATIONS, id],
    queryFn: () => request.get<BagTypeConfiguration>(`/api/bag-type-configurations/${id}`).then(res => ({ ...res.data, id: res.data._id })),
    enabled: !!id,
  });
};

export const useCreateBagTypeConfiguration = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BagTypeConfiguration) => request.post<BagTypeConfiguration>('/api/bag-type-configurations', data).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [BAG_TYPE_CONFIGURATIONS] }),
  });
};

export const useUpdateBagTypeConfiguration = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<BagTypeConfiguration> }) => request.put<BagTypeConfiguration>(`/api/bag-type-configurations/${id}`, data).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [BAG_TYPE_CONFIGURATIONS] }),
  });
};

export const useDeleteBagTypeConfiguration = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request.delete(`/api/bag-type-configurations/${id}`).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [BAG_TYPE_CONFIGURATIONS] }),
  });
};

export const useCommodities = () => {
  return useQuery({
    queryKey: [COMMODITIES],
    queryFn: () => request.get<Commodity[]>('/api/commodities').then(res => res.data.map(item => ({ ...item, id: item._id }))),
  });
};

export const useCommodity = (id: string) => {
  return useQuery({
    queryKey: [COMMODITIES, id],
    queryFn: () => request.get<Commodity>(`/api/commodities/${id}`).then(res => ({ ...res.data, id: res.data._id })),
    enabled: !!id,
  });
};

export const useCreateCommodity = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Commodity) => request.post<Commodity>('/api/commodities', data).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [COMMODITIES] }),
  });
};

export const useUpdateCommodity = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Commodity> }) => request.put<Commodity>(`/api/commodities/${id}`, data).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [COMMODITIES] }),
  });
};

export const useDeleteCommodity = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request.delete(`/api/commodities/${id}`).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [COMMODITIES] }),
  });
};

export const useCompanies = () => {
  return useQuery({
    queryKey: [COMPANIES],
    queryFn: () => request.get<Company[]>('/api/companies').then(res => res.data.map(item => ({ ...item, id: item._id }))),
  });
};

export const useCompany = (id: string) => {
  return useQuery({
    queryKey: [COMPANIES, id],
    queryFn: () => request.get<Company>(`/api/companies/${id}`).then(res => ({ ...res.data, id: res.data._id })),
    enabled: !!id,
  });
};

export const useCreateCompany = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Company) => request.post<Company>('/api/companies', data).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [COMPANIES] }),
  });
};

export const useUpdateCompany = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Company> }) => request.put<Company>(`/api/companies/${id}`, data).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [COMPANIES] }),
  });
};

export const useDeleteCompany = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request.delete(`/api/companies/${id}`).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [COMPANIES] }),
  });
};

export const useCompanyGroups = () => {
  return useQuery({
    queryKey: [COMPANY_GROUPS],
    queryFn: () => request.get<CompanyGroup[]>('/api/company-groups').then(res => res.data.map(item => ({ ...item, id: item._id }))),
  });
};

export const useCompanyGroup = (id: string) => {
  return useQuery({
    queryKey: [COMPANY_GROUPS, id],
    queryFn: () => request.get<CompanyGroup>(`/api/company-groups/${id}`).then(res => ({ ...res.data, id: res.data._id })),
    enabled: !!id,
  });
};

export const useCreateCompanyGroup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CompanyGroup) => request.post<CompanyGroup>('/api/company-groups', data).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [COMPANY_GROUPS] }),
  });
};

export const useUpdateCompanyGroup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CompanyGroup> }) => request.put<CompanyGroup>(`/api/company-groups/${id}`, data).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [COMPANY_GROUPS] }),
  });
};

export const useDeleteCompanyGroup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request.delete(`/api/company-groups/${id}`).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [COMPANY_GROUPS] }),
  });
};

export const useGrades = () => {
  return useQuery({
    queryKey: [GRADES],
    queryFn: () => request.get<Grade[]>('/api/grades').then(res => res.data.map(item => ({ ...item, id: item._id }))),
  });
};

export const useGrade = (id: string) => {
  return useQuery({
    queryKey: [GRADES, id],
    queryFn: () => request.get<Grade>(`/api/grades/${id}`).then(res => ({ ...res.data, id: res.data._id })),
    enabled: !!id,
  });
};

export const useCreateGrade = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Grade) => request.post<Grade>('/api/grades', data).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [GRADES] }),
  });
};

export const useUpdateGrade = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Grade> }) => request.put<Grade>(`/api/grades/${id}`, data).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [GRADES] }),
  });
};

export const useDeleteGrade = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request.delete(`/api/grades/${id}`).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [GRADES] }),
  });
};

export const useSourceLocations = () => {
  return useQuery({
    queryKey: [SOURCE_LOCATIONS],
    queryFn: () => request.get<SourceLocation[]>('/api/source-locations').then(res => res.data.map(item => ({ ...item, id: item._id }))),
  });
};

export const useSourceLocation = (id: string) => {
  return useQuery({
    queryKey: [SOURCE_LOCATIONS, id],
    queryFn: () => request.get<SourceLocation>(`/api/source-locations/${id}`).then(res => ({ ...res.data, id: res.data._id })),
    enabled: !!id,
  });
};

export const useCreateSourceLocation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SourceLocation) => request.post<SourceLocation>('/api/source-locations', data).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [SOURCE_LOCATIONS] }),
  });
};

export const useUpdateSourceLocation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SourceLocation> }) => request.put<SourceLocation>(`/api/source-locations/${id}`, data).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [SOURCE_LOCATIONS] }),
  });
};

export const useDeleteSourceLocation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request.delete(`/api/source-locations/${id}`).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [SOURCE_LOCATIONS] }),
  });
};

export const useVendors = () => {
  return useQuery({
    queryKey: [VENDORS],
    queryFn: () => request.get<Vendor[]>('/api/vendors').then(res => res.data.map(item => ({ ...item, id: item._id }))),
  });
};

export const useVendor = (id: string) => {
  return useQuery({
    queryKey: [VENDORS, id],
    queryFn: () => request.get<Vendor>(`/api/vendors/${id}`).then(res => ({ ...res.data, id: res.data._id })),
    enabled: !!id,
  });
};

export const useCreateVendor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Vendor) => request.post<Vendor>('/api/vendors', data).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [VENDORS] }),
  });
};

export const useUpdateVendor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Vendor> }) => request.put<Vendor>(`/api/vendors/${id}`, data).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [VENDORS] }),
  });
};

export const useDeleteVendor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request.delete(`/api/vendors/${id}`).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [VENDORS] }),
  });
};

export const useVendorBankDetailsList = () => {
  return useQuery({
    queryKey: [VENDOR_BANK_DETAILS],
    queryFn: () => request.get<VendorBankDetails[]>('/api/vendor-bank-details').then(res => res.data.map(item => ({ ...item, id: item._id }))),
  });
};

export const useVendorBankDetails = (id: string) => {
  return useQuery({
    queryKey: [VENDOR_BANK_DETAILS, id],
    queryFn: () => request.get<VendorBankDetails>(`/api/vendor-bank-details/${id}`).then(res => ({ ...res.data, id: res.data._id })),
    enabled: !!id,
  });
};

export const useCreateVendorBankDetails = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: VendorBankDetails) => request.post<VendorBankDetails>('/api/vendor-bank-details', data).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [VENDOR_BANK_DETAILS] }),
  });
};

export const useUpdateVendorBankDetails = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<VendorBankDetails> }) => request.put<VendorBankDetails>(`/api/vendor-bank-details/${id}`, data).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [VENDOR_BANK_DETAILS] }),
  });
};

export const useDeleteVendorBankDetails = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request.delete(`/api/vendor-bank-details/${id}`).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [VENDOR_BANK_DETAILS] }),
  });
};

export const useWarehouseLocations = () => {
  return useQuery({
    queryKey: [WAREHOUSE_LOCATIONS],
    queryFn: () => request.get<WarehouseLocation[]>('/api/warehouse-locations').then(res => res.data.map(item => ({ ...item, id: item._id }))),
  });
};

export const useWarehouseLocation = (id: string) => {
  return useQuery({
    queryKey: [WAREHOUSE_LOCATIONS, id],
    queryFn: () => request.get<WarehouseLocation>(`/api/warehouse-locations/${id}`).then(res => ({ ...res.data, id: res.data._id })),
    enabled: !!id,
  });
};

export const useCreateWarehouseLocation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: WarehouseLocation) => request.post<WarehouseLocation>('/api/warehouse-locations', data).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [WAREHOUSE_LOCATIONS] }),
  });
};

export const useUpdateWarehouseLocation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<WarehouseLocation> }) => request.put<WarehouseLocation>(`/api/warehouse-locations/${id}`, data).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [WAREHOUSE_LOCATIONS] }),
  });
};

export const useDeleteWarehouseLocation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request.delete(`/api/warehouse-locations/${id}`).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [WAREHOUSE_LOCATIONS] }),
  });
};

export const useMachines = () => {
  return useQuery({
    queryKey: [MACHINES],
    queryFn: () => request.get<Machine[]>('/api/machines').then(res => res.data.map(item => ({ ...item, id: item._id }))),
  });
};

export const useMachine = (id: string) => {
  return useQuery({
    queryKey: [MACHINES, id],
    queryFn: () => request.get<Machine>(`/api/machines/${id}`).then(res => ({ ...res.data, id: res.data._id })),
    enabled: !!id,
  });
};

export const useCreateMachine = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Machine) => request.post<Machine>('/api/machines', data).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [MACHINES] }),
  });
};

export const useUpdateMachine = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Machine> }) => request.put<Machine>(`/api/machines/${id}`, data).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [MACHINES] }),
  });
};

export const useDeleteMachine = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request.delete(`/api/machines/${id}`).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [MACHINES] }),
  });
};

export const useWeighBridges = () => {
  return useQuery({
    queryKey: [WEIGH_BRIDGES],
    queryFn: () => request.get<WeighBridge[]>('/api/weigh-bridges').then(res => res.data.map(item => ({ ...item, id: item._id }))),
  });
};

export const useWeighBridge = (id: string) => {
  return useQuery({
    queryKey: [WEIGH_BRIDGES, id],
    queryFn: () => request.get<WeighBridge>(`/api/weigh-bridges/${id}`).then(res => ({ ...res.data, id: res.data._id })),
    enabled: !!id,
  });
};

export const useCreateWeighBridge = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: WeighBridge) => request.post<WeighBridge>('/api/weigh-bridges', data).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [WEIGH_BRIDGES] }),
  });
};

export const useUpdateWeighBridge = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<WeighBridge> }) => request.put<WeighBridge>(`/api/weigh-bridges/${id}`, data).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [WEIGH_BRIDGES] }),
  });
};

export const useDeleteWeighBridge = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request.delete(`/api/weigh-bridges/${id}`).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [WEIGH_BRIDGES] }),
  });
};
