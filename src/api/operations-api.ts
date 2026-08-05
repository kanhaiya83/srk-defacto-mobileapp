import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import request from './request';

export interface InwardWeighBridgeEntry {
  _id: string;
  wbi_id: string;
  date: string;
  vehicle_no: string;
  driver_name: string;
  mobile_no: string;
  drivers_license_no: string;
  rc_copy_no: string;
  weight_fully_loaded: number;
  empty_weight: number;
  net_weight: number;
  source_location_id: string;
  commodity_ids: string[];
  total_bags: number;
  images: string[];
  is_mutable: boolean;
  is_deletable: boolean;
  weigh_bridge_id: string;
  slip_number: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface GenerateGrnEntryItem {
  _id: string;
  commodity_id: string;
  grade_id: string;
  bag_type_id: string;
  base_bag_type_id?: string;
  bags_used: number;
  sample_collected: boolean;
  sample_not_collected_reason?: string;
  location_id: string;
  sub_location_id: string;
  remarks: string;
  vehicle_photo: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface GenerateGrnEntry {
  _id: string;
  grn_id: string;
  wbi_id: string;
  total_bags: number;
  date: string;
  is_mutable: boolean;
  is_deletable: boolean;
  entries: GenerateGrnEntryItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Company {
  _id: string;
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

export interface BillEntry {
  _id: string;
  bill_number: number;
  grn_id: string;
  grn_entry_item_id?: string;
  commodity_id: string;
  company_id: string;
  company?: Company;
  agent_id: string;
  party_id: string;
  bill_no: string;
  bill_date: Date;
  eway_no: string;
  grade_id: string;
  total_bags: number;
  bill_weight: number;
  rate: number;
  amount: number;
  other_exp1: number;
  other_exp2: number;
  other_exp3: number;
  adhat_exp: number;
  dalali: number;
  kkc: number;
  mandi_tax: number;
  labour_exp: number;
  amount_before_gst: number;
  cgst: number;
  sgst: number;
  igst: number;
  amount_after_gst: number;
  discount: number;
  net_amount: number;
  baradana_type_id: string;
  transport_amount: number;
  freight_type_id: string;
  remarks: string;
  adjustment_amount?: number;
  adjustment_bags?: number;
  adjustment_weight?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface BillAssignment {
  _id: string;
  grn_id: string;
  bill_entry_id: string;
  grn_entry_item_id: string;
  assigned_bags: number;
  assigned_weight: number;
  assigned_base_amount: number;
  assigned_amount_with_expenses_before_gst: number;
  assigned_adjusted_amount_with_expenses_before_gst?: number;
  assigned_unadjusted_bags?: number;
  assigned_unadjusted_weight?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface InwardEntry {
  _id: string;
  entry_no: string;
  grn_id: string;
  grn_entry_item_id: string;
  bill_entry_ids: string[];
  bill_assignment_ids?: string[];
  grn_entry_item_data?: GenerateGrnEntryItem;
  grn?: GenerateGrnEntry;
  stock_ledger_id?: string;
  total_bags?: number;
  allocated_bags?: number;
  available_bags?: number;
  inward_rate?: number;
  total_weight?: number;
  allocated_weight?: number;
  available_weight?: number;
  createdAt?: string;
  updatedAt?: string;
}

// StockLedger Types
export interface StockLedgerEntry {
  _id: string;
  source_type: 'INWARD' | 'LOT_OUTPUT' | 'TRANSFER' | 'INITIAL_STOCK';
  inward_id?: any;
  lot_id?: any;
  lot_output_index?: number;
  transfer_id?: any;
  transfer_from_id?: any;
  entry_no: string;
  commodity_id: any;
  grade_id: any;
  bag_type_id: any;
  company_id?: any;
  company_group_id: any;
  location_id: any;
  sub_location_id: string;
  original_bags: number;
  original_weight: number;
  original_amount: number;
  unadjusted_amount?: number;
  unadjusted_bags?: number;
  unadjusted_weight?: number;
  allocated_bags: number;
  allocated_weight: number;
  outward_allocated_bags: number;
  outward_allocated_weight: number;
  consumed_bags: number;
  consumed_weight: number;
  outward_bags: number;
  outward_weight: number;
  transferred_bags: number;
  transferred_weight: number;
  available_bags: number;
  available_weight: number;
  weight_per_bag: number;
  rate_per_kg: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface StockLedgerTransaction {
  _id: string;
  stock_ledger_id: string;
  type: string;
  bucket: 'ALLOCATED' | 'CONSUMED' | 'OUTWARD_ALLOCATED' | 'OUTWARD' | 'TRANSFERRED';
  bags: number;
  weight: number;
  amount?: number;
  reference: { model: string; id: string };
  date: string;
  remarks?: string;
  balance_after?: Record<string, number>;
}

const INWARD_WEIGH_BRIDGE_ENTRIES = 'inward-weigh-bridge-entries';
const GENERATE_GRN_ENTRIES = 'generate-grn-entries';
const GENERATE_GRN_ENTRY_ITEMS = 'generate-grn-entry-items';
const BILL_ENTRIES = 'bill-entries';
const BILL_ASSIGNMENTS = 'bill-assignments';
const INWARD_ENTRIES = 'inward-entries';
const STOCK_LEDGER = 'stock-ledger';
const STOCK_LEDGER_HISTORY = 'stock-ledger-history';
const STOCK_LEDGER_TXNS_BY_REF = 'stock-ledger-txns-by-ref';

// Initial Stock Types
export interface InitialStockEntry {
  _id: string;
  stock_no: number;
  date: string;
  commodity_id: any;
  grade_id: any;
  bag_type_id: any;
  company_group_id: any;
  company_id?: any;
  location_id: any;
  sub_location_id: string;
  bags: number;
  weight: number;
  amount: number;
  remarks?: string;
  stock_ledger_id?: any;
  createdAt?: string;
  updatedAt?: string;
}

const INITIAL_STOCKS = 'initial-stocks';

// Bag Stock Keys
const BAG_STOCK_SUMMARY = 'bag-stock-summary';
const BAG_STOCK_MANUAL_ENTRIES = 'bag-stock-manual-entries';

// Types for Bag Stock
export interface BagStockLedgerEntry {
  _id: string;
  bag_type_config_id: any;
  filled_bags: number;
  empty_bags: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface BagStockManualEntry {
  _id: string;
  bag_type_config_id: any;
  qty: number;
  status: 'FILLED' | 'EMPTY';
  date: string;
  remarks?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const useInwardWeighBridgeEntries = () => {
  return useQuery({
    queryKey: [INWARD_WEIGH_BRIDGE_ENTRIES],
    queryFn: () => request.get<InwardWeighBridgeEntry[]>('/api/inward-weigh-bridge-entries').then(res => res.data),
  });
};

export const useInwardWeighBridgeEntry = (id: string) => {
  return useQuery({
    queryKey: [INWARD_WEIGH_BRIDGE_ENTRIES, id],
    queryFn: () => request.get<InwardWeighBridgeEntry>(`/api/inward-weigh-bridge-entries/${id}`).then(res => res.data),
    enabled: !!id,
  });
};

export const useCreateInwardWeighBridgeEntry = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: InwardWeighBridgeEntry) => request.post<InwardWeighBridgeEntry>('/api/inward-weigh-bridge-entries', data).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [INWARD_WEIGH_BRIDGE_ENTRIES] }),
  });
};

export const useUpdateInwardWeighBridgeEntry = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InwardWeighBridgeEntry> }) => request.put<InwardWeighBridgeEntry>(`/api/inward-weigh-bridge-entries/${id}`, data).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [INWARD_WEIGH_BRIDGE_ENTRIES] }),
  });
};

export const useDeleteInwardWeighBridgeEntry = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request.delete(`/api/inward-weigh-bridge-entries/${id}`).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [INWARD_WEIGH_BRIDGE_ENTRIES] }),
  });
};

export const useGenerateGrnEntries = () => {
  return useQuery({
    queryKey: [GENERATE_GRN_ENTRIES],
    queryFn: () => request.get<GenerateGrnEntry[]>('/api/generate-grn-entries').then(res => res.data),
  });
};

export const useGenerateGrnEntry = (id: string) => {
  return useQuery({
    queryKey: [GENERATE_GRN_ENTRIES, id],
    queryFn: () => request.get<GenerateGrnEntry>(`/api/generate-grn-entries/${id}`).then(res => res.data),
    enabled: !!id,
  });
};

export const useCreateGenerateGrnEntry = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: GenerateGrnEntry) => request.post<GenerateGrnEntry>('/api/generate-grn-entries', data).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [GENERATE_GRN_ENTRIES] }),
  });
};

export const useUpdateGenerateGrnEntry = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<GenerateGrnEntry> }) => request.put<GenerateGrnEntry>(`/api/generate-grn-entries/${id}`, data).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [GENERATE_GRN_ENTRIES] }),
  });
};

export const useDeleteGenerateGrnEntry = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request.delete(`/api/generate-grn-entries/${id}`).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [GENERATE_GRN_ENTRIES] }),
  });
};

export const useGenerateGrnEntryItems = () => {
  return useQuery({
    queryKey: [GENERATE_GRN_ENTRY_ITEMS],
    queryFn: () => request.get<GenerateGrnEntryItem[]>('/api/generate-grn-entry-items').then(res => res.data),
  });
};

export const useGenerateGrnEntryItem = (id: string) => {
  return useQuery({
    queryKey: [GENERATE_GRN_ENTRY_ITEMS, id],
    queryFn: () => request.get<GenerateGrnEntryItem>(`/api/generate-grn-entry-items/${id}`).then(res => res.data),
    enabled: !!id,
  });
};

export const useCreateGenerateGrnEntryItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: GenerateGrnEntryItem) => request.post<GenerateGrnEntryItem>('/api/generate-grn-entry-items', data).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [GENERATE_GRN_ENTRY_ITEMS] }),
  });
};

export const useUpdateGenerateGrnEntryItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<GenerateGrnEntryItem> }) => request.put<GenerateGrnEntryItem>(`/api/generate-grn-entry-items/${id}`, data).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [GENERATE_GRN_ENTRY_ITEMS] }),
  });
};

export const useDeleteGenerateGrnEntryItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request.delete(`/api/generate-grn-entry-items/${id}`).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [GENERATE_GRN_ENTRY_ITEMS] }),
  });
};

export const useBillEntries = () => {
  return useQuery({
    queryKey: [BILL_ENTRIES],
    queryFn: () => request.get<BillEntry[]>('/api/bill-entries').then(res => res.data),
  });
};

export const useBillEntry = (id: string) => {
  return useQuery({
    queryKey: [BILL_ENTRIES, id],
    queryFn: () => request.get<BillEntry>(`/api/bill-entries/${id}`).then(res => res.data),
    enabled: !!id,
  });
};

export const useCreateBillEntry = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BillEntry) => request.post<BillEntry>('/api/bill-entries', data).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [BILL_ENTRIES] }),
  });
};

export const useUpdateBillEntry = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<BillEntry> }) => request.put<BillEntry>(`/api/bill-entries/${id}`, data).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [BILL_ENTRIES] }),
  });
};

export const useDeleteBillEntry = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request.delete(`/api/bill-entries/${id}`).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [BILL_ENTRIES] }),
  });
};

// Bill Entries by GRN
export const useBillEntriesByGrn = (grnId: string) => {
  return useQuery({
    queryKey: [BILL_ENTRIES, 'grn', grnId],
    queryFn: () => request.get<BillEntry[]>(`/api/bill-entries?grn_id=${grnId}`).then(res => res.data),
    enabled: !!grnId,
  });
};

export const useBillAssignments = (grnId: string) => {
  return useQuery({
    queryKey: [BILL_ASSIGNMENTS, grnId],
    queryFn: () => request.get<BillAssignment[]>(`/api/bill-assignments?grn_id=${grnId}`).then(res => res.data),
    enabled: !!grnId,
  });
};

export const useAllBillAssignments = () => {
  return useQuery({
    queryKey: [BILL_ASSIGNMENTS, 'all'],
    queryFn: () => request.get<BillAssignment[]>('/api/bill-assignments').then(res => res.data),
  });
};

export const useSaveBillAssignments = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { grn_id: string; assignments: Omit<BillAssignment, '_id' | 'grn_id' | 'assigned_base_amount' | 'assigned_amount_with_expenses_before_gst' | 'createdAt' | 'updatedAt'>[] }) =>
      request.post<BillAssignment[]>('/api/bill-assignments', data).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BILL_ASSIGNMENTS] });
      queryClient.invalidateQueries({ queryKey: [BILL_ENTRIES] });
    },
  });
};

export const useDeleteBillAssignmentsByGrn = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (grnId: string) => request.delete(`/api/bill-assignments?grn_id=${grnId}`).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [BILL_ASSIGNMENTS] }),
  });
};

export const useInwardEntries = () => {
  return useQuery({
    queryKey: [INWARD_ENTRIES],
    queryFn: () => request.get<InwardEntry[]>('/api/inward-entries').then(res => res.data),
  });
};

export const useInwardEntry = (id: string) => {
  return useQuery({
    queryKey: [INWARD_ENTRIES, id],
    queryFn: () => request.get<InwardEntry>(`/api/inward-entries/${id}`).then(res => res.data),
    enabled: !!id,
  });
};

export const useCreateInwardEntry = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: InwardEntry) => request.post<InwardEntry>('/api/inward-entries', data).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [INWARD_ENTRIES] }),
  });
};

export const useUpdateInwardEntry = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InwardEntry> }) => request.put<InwardEntry>(`/api/inward-entries/${id}`, data).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [INWARD_ENTRIES] }),
  });
};

export const useDeleteInwardEntry = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request.delete(`/api/inward-entries/${id}`).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [INWARD_ENTRIES] }),
  });
};

// StockLedger Queries
export const useStockLedger = (params?: { company_group_id?: string; commodity_id?: string; available_only?: boolean }) => {
  return useQuery({
    queryKey: [STOCK_LEDGER, params],
    queryFn: () => {
      const searchParams = new URLSearchParams();
      if (params?.company_group_id) searchParams.set('company_group_id', params.company_group_id);
      if (params?.commodity_id) searchParams.set('commodity_id', params.commodity_id);
      if (params?.available_only) searchParams.set('available_only', 'true');
      const qs = searchParams.toString();
      return request.get<StockLedgerEntry[]>(`/api/stock-ledger${qs ? `?${qs}` : ''}`).then(res => res.data);
    },
    enabled: !params || !!(params.company_group_id || params.commodity_id || params.available_only !== undefined),
  });
};

export const useStockLedgerAll = () => {
  return useQuery({
    queryKey: [STOCK_LEDGER, 'all'],
    queryFn: () => request.get<StockLedgerEntry[]>('/api/stock-ledger').then(res => res.data),
  });
};

// Bag Stock Queries & Mutations
export const useBagStockSummary = () => {
  return useQuery({
    queryKey: [BAG_STOCK_SUMMARY],
    queryFn: () => request.get<BagStockLedgerEntry[]>('/api/bag-stock/summary').then(res => res.data),
  });
};

export const useBagStockManualEntries = () => {
  return useQuery({
    queryKey: [BAG_STOCK_MANUAL_ENTRIES],
    queryFn: () => request.get<BagStockManualEntry[]>('/api/bag-stock/manual-entries').then(res => res.data),
  });
};

export const useCreateBagStockManualEntry = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<BagStockManualEntry, '_id' | 'createdAt' | 'updatedAt' | 'bag_type_config_id'> & { bag_type_config_id: string }) => 
      request.post<BagStockManualEntry>('/api/bag-stock/manual-entry', data).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BAG_STOCK_MANUAL_ENTRIES] });
      queryClient.invalidateQueries({ queryKey: [BAG_STOCK_SUMMARY] });
    },
  });
};

// PreLot Types
export interface PreLotAllocation {
  _id?: string;
  stock_ledger_id: any;
  bags_allocated: number;
  allocated_weight: number;
  date?: string;
  source_type?: 'INWARD' | 'LOT_OUTPUT';
  entry_no?: string;
  original_bags?: number;
  inward_rate?: number;
  consumed_by_lots?: number;
  remaining_for_lots?: number;
  remaining_weight_for_lots?: number;
  effective_weight_per_bag?: number;
}

export interface PreLot {
  _id: string;
  prelot_no: number;
  date: string;
  commodity_id: string;
  company_group_id?: string;
  company_group?: {
    _id: string;
    group_name: string;
    company_ids: string[];
  };
  allocations: PreLotAllocation[];
  total_bags_allocated?: number;
  avg_input_rate?: number;
  remarks?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Lot Types
export interface LotInput {
  _id?: string;
  stock_ledger_id: any;
  bags_consumed: number;
  consumed_weight: number;
  date?: string;
}

export interface LotOutput {
  _id?: string;
  grade_id: string;
  bag_type_id: string;
  bags: number;
  avg_weight_per_bag: number;
  total_amount: number;
  location_id: string;
  sub_location_id: string;
  total_weight?: number;
  rate_per_kg?: number;
  date: string;
}

export interface Lot {
  _id: string;
  lot_no: number;
  date: string;
  prelot_id: string;
  commodity_id: string;
  machine_id?: string | null;
  is_complete: boolean;
  inputs: LotInput[];
  outputs: LotOutput[];
  waste_bags: number;
  total_input_bags?: number;
  total_input_weight?: number;
  total_input_amount?: number;
  avg_input_rate?: number;
  total_output_bags?: number;
  total_output_weight?: number;
  total_output_amount?: number;
  avg_output_rate_per_kg?: number;
  weight_difference?: number;
  amount_difference?: number;
  remarks?: string;
  createdAt?: string;
  updatedAt?: string;
}

const PRE_LOTS = 'pre-lots';
const LOTS = 'lots';

// PreLot Queries and Mutations
export const usePreLots = () => {
  return useQuery({
    queryKey: [PRE_LOTS],
    queryFn: () => request.get<PreLot[]>('/api/pre-lots').then(res => res.data),
  });
};

export const usePreLot = (id: string) => {
  return useQuery({
    queryKey: [PRE_LOTS, id],
    queryFn: () => request.get<PreLot>(`/api/pre-lots/${id}`).then(res => res.data),
    enabled: !!id,
  });
};

export const useCreatePreLot = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<PreLot, '_id' | 'prelot_no' | 'total_bags_allocated' | 'avg_input_rate' | 'createdAt' | 'updatedAt'>) =>
      request.post<PreLot>('/api/pre-lots', data).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PRE_LOTS] });
      queryClient.invalidateQueries({ queryKey: [STOCK_LEDGER] });
    },
  });
};

export const useUpdatePreLot = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PreLot> }) =>
      request.put<PreLot>(`/api/pre-lots/${id}`, data).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PRE_LOTS] });
      queryClient.invalidateQueries({ queryKey: [STOCK_LEDGER] });
    },
  });
};

export const useDeletePreLot = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request.delete(`/api/pre-lots/${id}`).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PRE_LOTS] });
      queryClient.invalidateQueries({ queryKey: [STOCK_LEDGER] });
    },
  });
};

// Lot Queries and Mutations
export const useLots = () => {
  return useQuery({
    queryKey: [LOTS],
    queryFn: () => request.get<Lot[]>('/api/lots').then(res => res.data),
  });
};

export const useLotOutputBagsCheck = (lotId: string) => {
  return useQuery({
    queryKey: ['lot-output-bags-check', lotId],
    queryFn: () => request.get<{ hasOutputBags: boolean }>(`/api/lots/${lotId}/output-bags-check`).then(res => res.data),
    enabled: !!lotId,
  });
};

export const useStockLedgerHistory = (stockLedgerId: string | null) => {
  return useQuery({
    queryKey: [STOCK_LEDGER_HISTORY, stockLedgerId],
    queryFn: () =>
      request.get<StockLedgerTransaction[]>(`/api/stock-ledger/${stockLedgerId}/history`).then(r => r.data),
    enabled: !!stockLedgerId,
  });
};

export const useTransactionsByReference = (model: string, id: string | null) => {
  return useQuery({
    queryKey: [STOCK_LEDGER_TXNS_BY_REF, model, id],
    queryFn: () =>
      request.get<StockLedgerTransaction[]>(`/api/stock-ledger-transactions?reference_model=${model}&reference_id=${id}`).then(r => r.data),
    enabled: !!id,
  });
};

export const useLot = (id: string) => {
  return useQuery({
    queryKey: [LOTS, id],
    queryFn: () => request.get<Lot>(`/api/lots/${id}`).then(res => res.data),
    enabled: !!id,
  });
};

export const useCreateLot = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Lot, '_id' | 'lot_no' | 'total_input_bags' | 'avg_input_rate' | 'total_output_bags' | 'total_output_weight' | 'total_output_amount' | 'avg_output_rate_per_kg' | 'createdAt' | 'updatedAt'>) =>
      request.post<Lot>('/api/lots', data).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LOTS] });
      queryClient.invalidateQueries({ queryKey: [STOCK_LEDGER] });
    },
  });
};

export const useUpdateLot = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Lot> }) =>
      request.put<Lot>(`/api/lots/${id}`, data).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LOTS] });
      queryClient.invalidateQueries({ queryKey: [STOCK_LEDGER] });
    },
  });
};

export const useDeleteLot = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request.delete(`/api/lots/${id}`).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [LOTS] }),
  });
};

export const useCompleteLot = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      request.post<Lot>(`/api/lots/${id}/complete`).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LOTS] });
      queryClient.invalidateQueries({ queryKey: [STOCK_LEDGER] });
    },
  });
};

// ─── Pre Outward ─────────────────────────────────────────────────────────────

export interface PreOutwardAllocation {
  _id?: string;
  stock_ledger_id: any;
  bags_allocated: number;
  allocated_weight: number;
  date?: string;
  // Enriched
  source_type?: 'INWARD' | 'LOT_OUTPUT';
  entry_no?: string;
  original_bags?: number;
  weight_per_bag?: number;
  rate_per_kg?: number;
  dispatched_bags?: number;
  remaining_bags?: number;
  effective_weight_per_bag?: number;
  has_company_id?: boolean;
  inward_company_id?: any; // populated company for INWARD entries
}

export interface PreOutward {
  _id: string;
  preout_no: number;
  date: string;
  company_group_id: any;
  commodities?: { _id: string; commodity_name: string }[];
  allocations: PreOutwardAllocation[];
  total_bags_allocated?: number;
  total_bags_dispatched?: number;
  total_bags_remaining?: number;
  remarks?: string;
  createdAt?: string;
  updatedAt?: string;
}

const PRE_OUTWARDS = 'pre-outwards';

export const usePreOutwards = () =>
  useQuery({
    queryKey: [PRE_OUTWARDS],
    queryFn: () => request.get<PreOutward[]>('/api/pre-outwards').then(res => res.data),
  });

export const usePreOutward = (id: string) =>
  useQuery({
    queryKey: [PRE_OUTWARDS, id],
    queryFn: () => request.get<PreOutward>(`/api/pre-outwards/${id}`).then(res => res.data),
    enabled: !!id,
  });

export const useCreatePreOutward = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<PreOutward, '_id' | 'preout_no' | 'total_bags_allocated' | 'total_bags_dispatched' | 'total_bags_remaining' | 'createdAt' | 'updatedAt'>) =>
      request.post<PreOutward>('/api/pre-outwards', data).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PRE_OUTWARDS] });
      queryClient.invalidateQueries({ queryKey: [STOCK_LEDGER] });
    },
  });
};

export const useUpdatePreOutward = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PreOutward> }) =>
      request.put<PreOutward>(`/api/pre-outwards/${id}`, data).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PRE_OUTWARDS] });
      queryClient.invalidateQueries({ queryKey: [STOCK_LEDGER] });
    },
  });
};

export const useDeletePreOutward = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request.delete(`/api/pre-outwards/${id}`).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PRE_OUTWARDS] });
      queryClient.invalidateQueries({ queryKey: [STOCK_LEDGER] });
    },
  });
};

export const useReleaseUnallocated = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request.post<PreOutward>(`/api/pre-outwards/${id}/release-unallocated`).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PRE_OUTWARDS] });
      queryClient.invalidateQueries({ queryKey: [STOCK_LEDGER] });
    },
  });
};

// ─── Outward Entry ───────────────────────────────────────────────────────────

export interface OutwardDispatch {
  _id?: string;
  stock_ledger_id: any;
  preoutward_id: any;
  bags_dispatched: number;
  dispatched_weight: number;
  // Enriched
  source_type?: 'INWARD' | 'LOT_OUTPUT';
  entry_no?: string;
  weight_per_bag?: number;
  rate_per_kg?: number;
  company_id?: any;
}

export interface OutwardEntry {
  _id: string;
  outward_no: number;
  vendor_id: any;
  company_group_id: any;
  commodities?: { _id: string; commodity_name: string }[];
  dispatches: OutwardDispatch[];
  date: string;
  total_bags?: number;
  total_weight?: number;
  remarks?: string;
  createdAt?: string;
  updatedAt?: string;
}

const OUTWARDS = 'outwards';

export const useOutwards = () =>
  useQuery({
    queryKey: [OUTWARDS],
    queryFn: () => request.get<OutwardEntry[]>('/api/outwards').then(res => res.data),
  });

export const useOutward = (id: string) =>
  useQuery({
    queryKey: [OUTWARDS, id],
    queryFn: () => request.get<OutwardEntry>(`/api/outwards/${id}`).then(res => res.data),
    enabled: !!id,
  });

export const useCreateOutward = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { date: string; preoutward_id: string; dispatches: Omit<OutwardDispatch, '_id' | 'source_type' | 'entry_no' | 'weight_per_bag' | 'rate_per_kg'>[]; remarks?: string }) =>
      request.post<OutwardEntry>('/api/outwards', data).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [OUTWARDS] });
      queryClient.invalidateQueries({ queryKey: [PRE_OUTWARDS] });
      queryClient.invalidateQueries({ queryKey: [STOCK_LEDGER] });
    },
  });
};

export const useUpdateOutward = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { date?: string; dispatches: Omit<OutwardDispatch, '_id' | 'preoutward_id' | 'source_type' | 'entry_no' | 'weight_per_bag' | 'rate_per_kg'>[]; remarks?: string } }) =>
      request.put<OutwardEntry>(`/api/outwards/${id}`, data).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [OUTWARDS] });
      queryClient.invalidateQueries({ queryKey: [PRE_OUTWARDS] });
      queryClient.invalidateQueries({ queryKey: [STOCK_LEDGER] });
    },
  });
};

export const useDeleteOutward = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request.delete(`/api/outwards/${id}`).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [OUTWARDS] });
      queryClient.invalidateQueries({ queryKey: [PRE_OUTWARDS] });
      queryClient.invalidateQueries({ queryKey: [STOCK_LEDGER] });
    },
  });
};

// ─── Outward Weigh Bridge (WBO) ───────────────────────────────────────────────

export interface OutwardWeighBridgeEntry {
  _id: string;
  wbo_id: string;
  outward_id: any;
  date: string;
  vehicle_no: string;
  driver_name: string;
  mobile_no: string;
  drivers_license_no: string;
  rc_copy_no: string;
  /** Captured on arrival (WBO Empty). */
  empty_weight?: number;
  /** Captured once loaded, together with `outward_id` (WBO Loaded). */
  weight_fully_loaded?: number;
  net_weight?: number;
  images: string[];
  is_mutable: boolean;
  is_deletable: boolean;
  createdAt?: string;
  updatedAt?: string;
}

const OUTWARD_WEIGH_BRIDGE = 'outward-weigh-bridge-entries';

export const useOutwardWeighBridgeEntries = () =>
  useQuery({
    queryKey: [OUTWARD_WEIGH_BRIDGE],
    queryFn: () => request.get<OutwardWeighBridgeEntry[]>('/api/outward-weigh-bridge-entries').then(res => res.data),
  });

export const useOutwardWeighBridgeEntry = (id: string) =>
  useQuery({
    queryKey: [OUTWARD_WEIGH_BRIDGE, id],
    queryFn: () => request.get<OutwardWeighBridgeEntry>(`/api/outward-weigh-bridge-entries/${id}`).then(res => res.data),
    enabled: !!id,
  });

export const useCreateOutwardWeighBridgeEntry = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<OutwardWeighBridgeEntry, '_id' | 'createdAt' | 'updatedAt'>) =>
      request.post<OutwardWeighBridgeEntry>('/api/outward-weigh-bridge-entries', data).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [OUTWARD_WEIGH_BRIDGE] }),
  });
};

export const useUpdateOutwardWeighBridgeEntry = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<OutwardWeighBridgeEntry> }) =>
      request.put<OutwardWeighBridgeEntry>(`/api/outward-weigh-bridge-entries/${id}`, data).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [OUTWARD_WEIGH_BRIDGE] }),
  });
};

export const useDeleteOutwardWeighBridgeEntry = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request.delete(`/api/outward-weigh-bridge-entries/${id}`).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [OUTWARD_WEIGH_BRIDGE] }),
  });
};

// ─── Outward Bills ───────────────────────────────────────────────────────────

/**
 * Sales bill raised against a whole outward. One outward may carry several
 * bills; a bill never spans outwards.
 */
export interface OutwardBillEntry {
  _id: string;
  bill_number: number;
  outward_id: string;
  /** Populated by the server. */
  company_id: any;
  /** Populated by the server. */
  party_id: any;
  bill_no: string;
  bill_date?: string;
  eway_no?: string;
  total_bags: number;
  bill_weight: number;
  rate: number;
  amount: number;
  other_exp1: number;
  other_exp2: number;
  other_exp3: number;
  dalali: number;
  labour_exp: number;
  transport_amount: number;
  freight_type_id?: string;
  amount_before_gst: number;
  cgst: number;
  sgst: number;
  igst: number;
  amount_after_gst: number;
  discount: number;
  net_amount: number;
  remarks?: string;
  is_mutable?: boolean;
  is_deletable?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type OutwardBillEntryInput = Omit<
  OutwardBillEntry,
  '_id' | 'bill_number' | 'createdAt' | 'updatedAt'
>;

const OUTWARD_BILL_ENTRIES = 'outward-bill-entries';

export const useOutwardBillEntries = (outwardId?: string) =>
  useQuery({
    queryKey: [OUTWARD_BILL_ENTRIES, outwardId ?? 'all'],
    queryFn: () =>
      request
        .get<OutwardBillEntry[]>(
          outwardId ? `/api/outward-bill-entries?outward_id=${outwardId}` : '/api/outward-bill-entries'
        )
        .then(res => res.data),
  });

export const useCreateOutwardBillEntry = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: OutwardBillEntryInput) =>
      request.post<OutwardBillEntry>('/api/outward-bill-entries', data).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [OUTWARD_BILL_ENTRIES] }),
  });
};

export const useUpdateOutwardBillEntry = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<OutwardBillEntryInput> }) =>
      request.put<OutwardBillEntry>(`/api/outward-bill-entries/${id}`, data).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [OUTWARD_BILL_ENTRIES] }),
  });
};

export const useDeleteOutwardBillEntry = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      request.delete(`/api/outward-bill-entries/${id}`).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [OUTWARD_BILL_ENTRIES] }),
  });
};

// ─── Sale Order ──────────────────────────────────────────────────────────────

export interface SaleOrderOrder {
  _id?: string;
  commodity_id: any;
  grade_id: any;
  total_weight: number;
  bags: number;
  rate: number;
}

export interface SaleOrder {
  _id: string;
  order_no: number;
  date: string;
  delivery_by_date?: string;
  is_completed: boolean;
  vendor_id: any;
  orders: SaleOrderOrder[];
  createdAt?: string;
  updatedAt?: string;
}

const SALE_ORDERS = 'sale-orders';

export const useSaleOrders = () =>
  useQuery({
    queryKey: [SALE_ORDERS],
    queryFn: () => request.get<SaleOrder[]>('/api/sale-orders').then(res => res.data),
  });

export const useSaleOrder = (id: string) =>
  useQuery({
    queryKey: [SALE_ORDERS, id],
    queryFn: () => request.get<SaleOrder>(`/api/sale-orders/${id}`).then(res => res.data),
    enabled: !!id,
  });

export const useCreateSaleOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<SaleOrder, '_id' | 'order_no' | 'createdAt' | 'updatedAt'>) =>
      request.post<SaleOrder>('/api/sale-orders', data).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [SALE_ORDERS] }),
  });
};

export const useUpdateSaleOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SaleOrder> }) =>
      request.put<SaleOrder>(`/api/sale-orders/${id}`, data).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [SALE_ORDERS] }),
  });
};

export const useDeleteSaleOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request.delete(`/api/sale-orders/${id}`).then(res => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [SALE_ORDERS] }),
  });
};

// ─── Stock Transfers ──────────────────────────────────────────────────────────

export interface StockTransfer {
  _id: string;
  transfer_no: number;
  date: string;
  status: 'ACTIVE' | 'CANCELLED';

  from_stock_ledger_id: any;
  from_company_id?: any;
  from_company_group_id: any;
  from_location_id: any;
  from_sub_location_id: string;

  to_stock_ledger_id?: any;
  to_company_id?: any;
  to_company_group_id: any;
  to_location_id: any;
  to_sub_location_id: string;

  bags: number;
  weight: number;
  remarks?: string;
  cancelled_at?: string;
  cancelled_reason?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateStockTransferInput {
  from_stock_ledger_id: string;
  bags: number;
  weight?: number;
  to_company_id?: string;
  to_company_group_id: string;
  to_location_id: string;
  to_sub_location_id: string;
  date?: string;
  remarks?: string;
}

const STOCK_TRANSFERS = 'stock-transfers';

export const useStockTransfers = (params?: {
  from_company_group_id?: string;
  to_company_group_id?: string;
  status?: string;
  from_stock_ledger_id?: string;
}) => {
  return useQuery({
    queryKey: [STOCK_TRANSFERS, params],
    queryFn: () => {
      const searchParams = new URLSearchParams();
      if (params?.from_company_group_id) searchParams.set('from_company_group_id', params.from_company_group_id);
      if (params?.to_company_group_id) searchParams.set('to_company_group_id', params.to_company_group_id);
      if (params?.status) searchParams.set('status', params.status);
      if (params?.from_stock_ledger_id) searchParams.set('from_stock_ledger_id', params.from_stock_ledger_id);
      const qs = searchParams.toString();
      return request.get<StockTransfer[]>(`/api/stock-transfers${qs ? `?${qs}` : ''}`).then(res => res.data);
    },
  });
};

export const useStockTransfer = (id: string) => {
  return useQuery({
    queryKey: [STOCK_TRANSFERS, id],
    queryFn: () => request.get<StockTransfer>(`/api/stock-transfers/${id}`).then(res => res.data),
    enabled: !!id,
  });
};

export const useCreateStockTransfer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateStockTransferInput) =>
      request.post<StockTransfer>('/api/stock-transfers', data).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [STOCK_TRANSFERS] });
      queryClient.invalidateQueries({ queryKey: [STOCK_LEDGER] });
    },
  });
};


export const useCancelStockTransfer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      request.post<{ message: string; transfer: StockTransfer }>(`/api/stock-transfers/${id}/cancel`, { reason }).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [STOCK_TRANSFERS] });
      queryClient.invalidateQueries({ queryKey: [STOCK_LEDGER] });
    },
  });
};

// ─── Initial Stock ───────────────────────────────────────────────────────────

export const useInitialStocks = () => {
  return useQuery({
    queryKey: [INITIAL_STOCKS],
    queryFn: () => request.get<InitialStockEntry[]>('/api/initial-stocks').then(res => res.data),
  });
};

export const useInitialStock = (id: string) => {
  return useQuery({
    queryKey: [INITIAL_STOCKS, id],
    queryFn: () => request.get<InitialStockEntry>(`/api/initial-stocks/${id}`).then(res => res.data),
    enabled: !!id,
  });
};

export const useCreateInitialStock = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<InitialStockEntry, '_id' | 'stock_no' | 'stock_ledger_id' | 'createdAt' | 'updatedAt'>) =>
      request.post<InitialStockEntry>('/api/initial-stocks', data).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INITIAL_STOCKS] });
      queryClient.invalidateQueries({ queryKey: [STOCK_LEDGER] });
      queryClient.invalidateQueries({ queryKey: [BAG_STOCK_SUMMARY] });
    },
  });
};

export const useUpdateInitialStock = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InitialStockEntry> }) =>
      request.put<InitialStockEntry>(`/api/initial-stocks/${id}`, data).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INITIAL_STOCKS] });
      queryClient.invalidateQueries({ queryKey: [STOCK_LEDGER] });
      queryClient.invalidateQueries({ queryKey: [BAG_STOCK_SUMMARY] });
    },
  });
};

export const useDeleteInitialStock = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request.delete(`/api/initial-stocks/${id}`).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INITIAL_STOCKS] });
      queryClient.invalidateQueries({ queryKey: [STOCK_LEDGER] });
      queryClient.invalidateQueries({ queryKey: [BAG_STOCK_SUMMARY] });
    },
  });
};

