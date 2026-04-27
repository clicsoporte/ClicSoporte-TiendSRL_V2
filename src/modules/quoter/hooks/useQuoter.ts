/**
 * @fileoverview Custom hook `useQuoter` for managing the state and logic of the QuoterPage component.
 */
"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/modules/core/hooks/use-toast";
import { usePageTitle } from "@/modules/core/hooks/usePageTitle";
import type { Customer, Product, Company, QuoteDraft, QuoteLine, Exemption, HaciendaExemptionApiResponse } from "@/modules/core/types";
import {
  saveQuoteDraft,
  getAllQuoteDrafts,
  deleteQuoteDraft,
} from "@/modules/quoter/lib/actions";
import { saveCompanySettings } from "@/modules/core/lib/settings-db";
import { useDebounce } from "use-debounce";
import { useAuth } from "@/modules/core/hooks/useAuth";
import { generateDocument } from "@/modules/core/lib/pdf-generator";
import { getExemptionStatus } from "@/modules/hacienda/lib/actions";
import { sendQuoteByEmail } from "@/modules/quoter/lib/email-actions";
import type { RowInput } from "jspdf-autotable";

const initialQuoteState = {
  lines: [] as QuoteLine[],
  selectedCustomer: null as Customer | null,
  customerDetails: "",
  deliveryAddress: "",
  deliveryDate: "",
  sellerName: "",
  quoteDate: "",
  validUntilDate: "",
  paymentTerms: "contado",
  creditDays: 0,
  notes: "Precios sujetos a cambio sin previo aviso.",
  decimalPlaces: 2,
  purchaseOrderNumber: "",
};

type ExemptionInfo = {
    erpExemption: Exemption;
    haciendaExemption: HaciendaExemptionApiResponse | { error: boolean; message: string; status?: number } | null;
    isLoading: boolean;
    isErpValid: boolean;
    isHaciendaValid: boolean;
    isSpecialLaw: boolean;
    apiError: boolean;
};

interface LineInputRefs {
  qty: HTMLInputElement | null;
  price: HTMLInputElement | null;
}

type ErrorResponse = { error: boolean; message: string; status?: number };

export function isErrorResponse(data: unknown): data is ErrorResponse {
  return (data as ErrorResponse)?.error !== undefined;
}

const normalizeNumber = (value: string): number => {
    if (typeof value !== 'string' || !value.trim()) return 0;
    const standardizedValue = value.replace(/,/g, '.');
    const validNumberString = standardizedValue.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
    const parsed = parseFloat(validNumberString);
    return isNaN(parsed) ? 0 : parsed;
};

export const useQuoter = () => {
  const { toast } = useToast();
  const { setTitle } = usePageTitle();
  const { 
    user: currentUser, customers, products, companyData: authCompanyData, 
    exchangeRateData, allExemptions, refreshAuth 
  } = useAuth();
  
  const [quoteNumber, setQuoteNumber] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currency, setCurrency] = useState("CRC");
  const [lines, setLines] = useState<QuoteLine[]>(initialQuoteState.lines);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(initialQuoteState.selectedCustomer);
  const [customerDetails, setCustomerDetails] = useState(initialQuoteState.customerDetails);
  const [deliveryAddress, setDeliveryAddress] = useState(initialQuoteState.deliveryAddress);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [purchaseOrderNumber, setPurchaseOrderNumber] = useState(initialQuoteState.purchaseOrderNumber);
  const [deliveryDate, setDeliveryDate] = useState(initialQuoteState.deliveryDate);
  const [sellerName, setSellerName] = useState(initialQuoteState.sellerName);
  const [quoteDate, setQuoteDate] = useState(initialQuoteState.quoteDate);
  const [companyData, setCompanyData] = useState<Company | null>(null);
  const [sellerType, setSellerType] = useState("user");
  const [paymentTerms, setPaymentTerms] = useState(initialQuoteState.paymentTerms);
  const [creditDays, setCreditDays] = useState(initialQuoteState.creditDays);
  const [validUntilDate, setValidUntilDate] = useState(initialQuoteState.validUntilDate);
  const [notes, setNotes] = useState(initialQuoteState.notes);
  const [showInactiveCustomers, setShowInactiveCustomers] = useState(false);
  const [showInactiveProducts, setShowInactiveProducts] = useState(false);
  const [selectedLineForInfo, setSelectedLineForInfo] = useState<QuoteLine | null>(null);
  const [savedDrafts, setSavedDrafts] = useState<(QuoteDraft & { customer: Customer | null})[]>([]);
  const [decimalPlaces, setDecimalPlaces] = useState(initialQuoteState.decimalPlaces);
  const [exemptionInfo, setExemptionInfo] = useState<ExemptionInfo | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Email Dialog State
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [selectedEmailRecipients, setSelectedEmailRecipients] = useState<string[]>([]);

  const [mobileColumnVisibility, setMobileColumnVisibility] = useState({
    code: false,
    unit: false,
    cabys: false,
    tax: false,
    total: true,
  });
  
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [isProductSearchOpen, setProductSearchOpen] = useState(false);
  const [isCustomerSearchOpen, setCustomerSearchOpen] = useState(false);

  const [debouncedCustomerSearch] = useDebounce(customerSearchTerm, authCompanyData?.searchDebounceTime ?? 500);
  const [debouncedProductSearch] = useDebounce(productSearchTerm, authCompanyData?.searchDebounceTime ?? 500);

  const productInputRef = useRef<HTMLInputElement>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);
  const lineInputRefs = useRef<Map<string, LineInputRefs>>(new Map());

  useEffect(() => {
    if (authCompanyData) {
        setCompanyData(authCompanyData);
        setQuoteNumber(`${authCompanyData.quotePrefix || "COT-"}${(authCompanyData.nextQuoteNumber || 1).toString().padStart(4, "0")}`);
        setDecimalPlaces(authCompanyData.decimalPlaces ?? 2);
    }
    if (exchangeRateData.rate) {
        setExchangeRate(exchangeRateData.rate);
    }
  }, [authCompanyData, exchangeRateData]);

  useEffect(() => {
    setTitle("Cotizador");
    if (!isMounted) {
        const today = new Date();
        setQuoteDate(today.toISOString().substring(0, 10));
        setDeliveryDate(today.toISOString().substring(0, 16));
        const validDate = new Date();
        validDate.setDate(today.getDate() + 8);
        setValidUntilDate(validDate.toISOString().substring(0, 10));
        setIsMounted(true);
    }
  }, [setTitle, isMounted]);

  useEffect(() => {
    if (sellerType === "user" && currentUser) {
      setSellerName(currentUser.name);
    } else if (sellerType === "manual") {
      setSellerName("");
    }
  }, [sellerType, currentUser]);

  const checkExemptionStatusInternal = useCallback(async (authNumber: string) => {
    setExemptionInfo(prev => prev ? { ...prev, isLoading: true, apiError: false } : null);
    const data = await getExemptionStatus(authNumber);
    if (isErrorResponse(data)) {
        setExemptionInfo(prev => prev ? { ...prev, haciendaExemption: data, isHaciendaValid: false, isLoading: false, apiError: true } : null);
        return;
    }
    setExemptionInfo(prev => prev ? { ...prev, haciendaExemption: data, isHaciendaValid: new Date(data.fechaVencimiento) > new Date(), isLoading: false, apiError: false } : null);
  }, []);

  const handleSelectCustomer = useCallback((customerId: string) => {
    setCustomerSearchOpen(false);
    if (!customerId) {
        setSelectedCustomer(null);
        setCustomerDetails("");
        setExemptionInfo(null);
        return;
    }
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
        setSelectedCustomer(customer);
        setCustomerDetails(`ID: ${customer.id}\nNombre: ${customer.name}\nCédula: ${customer.taxId}\nTel: ${customer.phone}`);
        setCustomerSearchTerm(`[${customer.id}] ${customer.name}`);
        setDeliveryAddress(customer.address);
        const days = parseInt(customer.paymentCondition, 10);
        if (!isNaN(days) && days > 1) { setPaymentTerms("credito"); setCreditDays(days); }
        else { setPaymentTerms("contado"); setCreditDays(0); }
        const ex = allExemptions.find(e => e.customer?.trim() === customer.id.trim());
        if (ex) {
            setExemptionInfo({ erpExemption: ex, haciendaExemption: null, isLoading: true, isErpValid: new Date(ex.endDate) > new Date(), isHaciendaValid: false, isSpecialLaw: false, apiError: false });
            checkExemptionStatusInternal(ex.authNumber);
        } else { setExemptionInfo(null); }
    }
  }, [customers, allExemptions, checkExemptionStatusInternal]);

  const addLineInternal = useCallback((product: Product) => {
    const newLineId = new Date().toISOString();
    let tax = 0.13;
    if (product.isBasicGood === 'S') tax = 0.01;
    setLines(prev => [...prev, { id: newLineId, product, quantity: 0, price: 0, tax, displayQuantity: "", displayPrice: "" }]);
  }, []);

  const handleSelectProduct = useCallback((productId: string) => {
    setProductSearchOpen(false);
    if (!productId) return;
    const product = products.find(p => p.id === productId);
    if (product) {
        addLineInternal(product);
        setProductSearchTerm("");
    }
  }, [products, addLineInternal]);

  const totals = useMemo(() => {
    const subtotal = lines.reduce((acc, l) => acc + (l.quantity * l.price), 0);
    const tax = lines.reduce((acc, l) => acc + (l.quantity * l.price * l.tax), 0);
    return { subtotal, totalTaxes: tax, total: subtotal + tax };
  }, [lines]);

  const customerOptions = useMemo(() => {
    if (debouncedCustomerSearch.length < 2) return [];
    return customers.filter(c => (showInactiveCustomers || c.active === "S") && `${c.id} ${c.name} ${c.taxId}`.toLowerCase().includes(debouncedCustomerSearch.toLowerCase()))
        .map(c => ({ value: c.id, label: `[${c.id}] - ${c.name} (${c.taxId})` }));
  }, [customers, showInactiveCustomers, debouncedCustomerSearch]);

  const productOptions = useMemo(() => {
    if (debouncedProductSearch.length < 2) return [];
    return products.filter(p => (showInactiveProducts || p.active === "S") && `${p.id} ${p.description}`.toLowerCase().includes(debouncedProductSearch.toLowerCase()))
        .map(p => ({ value: p.id, label: `${p.id} - ${p.description}` }));
  }, [products, showInactiveProducts, debouncedProductSearch]);

  const selectors = useMemo(() => ({
    totals, customerOptions, productOptions
  }), [totals, customerOptions, productOptions]);

  const actions = useMemo(() => ({
    setCurrency, setLines, setSelectedCustomer, setCustomerDetails, setDeliveryAddress, setExchangeRate,
    setPurchaseOrderNumber, setDeliveryDate, setSellerName, setQuoteDate, setSellerType, setPaymentTerms,
    setCreditDays, setValidUntilDate, setNotes, setShowInactiveCustomers,
    setShowInactiveProducts, setSelectedLineForInfo, setDecimalPlaces, setQuoteNumber,
    setProductSearchTerm, setCustomerSearchTerm, setProductSearchOpen, setCustomerSearchOpen,
    handleSelectCustomer, handleSelectProduct,
    setIsEmailDialogOpen,
    setSelectedEmailRecipients,
    addLine: addLineInternal,
    handleCustomerDetailsChange: (value: string) => {
        setCustomerDetails(value);
        if (selectedCustomer) {
            setSelectedCustomer(null);
            setExemptionInfo(null);
        }
    },
    removeLine: (id: string) => setLines(prev => prev.filter(l => l.id !== id)),
    updateLine: (id: string, f: Partial<QuoteLine>) => setLines(prev => prev.map(l => l.id === id ? { ...l, ...f } : l)),
    updateLineProductDetail: (id: string, f: Partial<Product>) => setLines(prev => prev.map(l => l.id === id ? { ...l, product: { ...l.product, ...f } } : l)),
    handleCurrencyToggle: () => {
        if (!exchangeRate) return;
        const newCurrency = currency === "CRC" ? "USD" : "CRC";
        setLines(prev => prev.map(l => {
            const p = newCurrency === "USD" ? l.price / exchangeRate : l.price * exchangeRate;
            return { ...l, price: p, displayPrice: String(p) };
        }));
        setCurrency(newCurrency);
    },
    formatCurrency: (amount: number) => {
        const p = currency === "CRC" ? "CRC " : "$ ";
        return `${p}${amount.toLocaleString("es-CR", { minimumFractionDigits: decimalPlaces, maximumFractionDigits: decimalPlaces })}`;
    },
    generatePDF: async () => {
        if (!companyData) return;
        setIsProcessing(true);
        const rows: RowInput[] = lines.map(l => [l.product.id, l.product.description, `${l.quantity} ${l.product.unit}`, l.product.cabys, String(l.price), `${(l.tax * 100).toFixed(0)}%`, String(l.quantity * l.price * (1 + l.tax))]);
        const doc = generateDocument({
            docTitle: "COTIZACIÓN", docId: quoteNumber, meta: [{ label: 'Fecha', value: quoteDate }],
            companyData, blocks: [{ title: 'Cliente', content: customerDetails }],
            table: { columns: ["Código", "Descripción", "Cant.", "Cabys", "Precio", "Imp.", "Total"], rows },
            totals: [{ label: 'Total:', value: String(totals.total) }]
        });
        doc.save(`${quoteNumber}.pdf`);
        setIsProcessing(false);
    },
    handleSendEmail: async () => {
        if (selectedEmailRecipients.length === 0) {
            toast({ title: "Faltan destinatarios", variant: "destructive" });
            return;
        }
        if (!companyData || !currentUser) return;
        
        setIsProcessing(true);
        try {
            await sendQuoteByEmail({
                recipients: selectedEmailRecipients,
                quoteNumber,
                companyData,
                customerName: selectedCustomer?.name || 'Cliente',
                customerDetails,
                lines,
                totals,
                currency,
                notes,
                sender: currentUser
            });
            toast({ title: "Cotización Enviada", description: `Se envió la propuesta a ${selectedEmailRecipients.length} contacto(s).` });
            setIsEmailDialogOpen(false);
        } catch (error: unknown) {
            const err = error as Error;
            toast({ title: "Error al enviar", description: err.message, variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    },
    resetQuote: () => { setLines([]); setSelectedCustomer(null); setCustomerDetails(""); setCustomerSearchTerm(""); setExemptionInfo(null); },
    saveDraft: async () => {
        if (!currentUser) return;
        setIsProcessing(true);
        try {
            await saveQuoteDraft({
                id: quoteNumber, createdAt: new Date().toISOString(), userId: currentUser.id,
                customerId: selectedCustomer?.id || null, customerDetails, lines, totals,
                notes, currency, exchangeRate, purchaseOrderNumber, deliveryAddress,
                deliveryDate, sellerName, sellerType, quoteDate, validUntilDate, paymentTerms, creditDays
            });
            toast({ title: "Borrador Guardado" });
        } finally { setIsProcessing(false); }
    },
    loadDrafts: async () => {
        if (!currentUser) return;
        const drafts = await getAllQuoteDrafts(currentUser.id);
        setSavedDrafts(drafts.map(d => ({ ...d, customer: customers.find(c => c.id === d.customerId) || null })));
    },
    handleLoadDraft: (d: QuoteDraft) => {
        setQuoteNumber(d.id); setLines(d.lines.map(l => ({ ...l, displayQuantity: String(l.quantity), displayPrice: String(l.price) })));
        setCurrency(d.currency); setExchangeRate(d.exchangeRate); setSelectedCustomer(d.customer || null);
    },
    handleDeleteDraft: async (id: string) => {
        await deleteQuoteDraft(id);
        setSavedDrafts(prev => prev.filter(d => d.id !== id));
    },
    handleNumericInputBlur: (id: string, field: 'quantity' | 'price', v: string) => {
        const num = normalizeNumber(v);
        setLines(prev => prev.map(l => l.id === id ? { ...l, [field]: num, [field === 'quantity' ? 'displayQuantity' : 'displayPrice']: String(num) } : l));
    },
    handleLineInputKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, id: string, f: 'qty' | 'price') => {
        if (e.key === 'Enter') {
            const refs = lineInputRefs.current.get(id);
            if (f === 'qty' && refs?.price) refs.price.focus();
            else if (f === 'price' && productInputRef.current) productInputRef.current.focus();
        }
    },
    handleProductInputKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && productOptions.length > 0) handleSelectProduct(productOptions[0].value);
    },
    handleCustomerInputKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && customerOptions.length > 0) handleSelectCustomer(customerOptions[0].value);
    },
    handleColumnVisibilityChange: (col: keyof typeof mobileColumnVisibility, checked: boolean) => setMobileColumnVisibility(prev => ({ ...prev, [col]: checked })),
    loadInitialData: async (isR = false) => { if (isR) { setIsRefreshing(true); await refreshAuth(); setIsRefreshing(false); } },
    handleSaveDecimalPlaces: async () => {
        if (!companyData) return;
        await saveCompanySettings({ ...companyData, decimalPlaces });
        toast({ title: "Precisión Guardada" });
    },
    checkExemptionStatus: (auth?: string) => { if (auth) checkExemptionStatusInternal(auth); }
  }), [toast, customers, exchangeRate, currentUser, currency, decimalPlaces, companyData, lines, quoteNumber, quoteDate, customerDetails, notes, totals, purchaseOrderNumber, deliveryAddress, deliveryDate, sellerName, sellerType, validUntilDate, paymentTerms, creditDays, productOptions, customerOptions, refreshAuth, checkExemptionStatusInternal, handleSelectCustomer, handleSelectProduct, addLineInternal, selectedCustomer, selectedEmailRecipients]);

  return {
    state: {
      currency, lines, selectedCustomer, customerDetails, deliveryAddress, exchangeRate, exchangeRateDate: exchangeRateData.date, exchangeRateLoaded: !!exchangeRateData.rate,
      quoteNumber, deliveryDate, sellerName, quoteDate, companyData, currentUser, sellerType,
      paymentTerms, creditDays, validUntilDate, notes, products, customers, showInactiveCustomers,
      showInactiveProducts, selectedLineForInfo, savedDrafts, decimalPlaces, productSearchTerm, purchaseOrderNumber,
      exemptionInfo, isRefreshing, customerSearchTerm, isProductSearchOpen, isCustomerSearchOpen, isProcessing,
      mobileColumnVisibility, isEmailDialogOpen, selectedEmailRecipients
    },
    actions,
    refs: { productInputRef, customerInputRef, lineInputRefs },
    selectors,
  };
};
