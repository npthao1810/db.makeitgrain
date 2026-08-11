import { createClient } from '@supabase/supabase-js';
import { useEffect, useMemo, useRef, useState } from 'react';

// Production uses same-origin /api routes. Local development keeps the
// dedicated Express server unless an explicit API URL is supplied.
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
  ?? (import.meta.env.DEV ? 'http://localhost:5001' : '');
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Keep fractional costs in the database for FIFO accuracy, but VND has no
// practical sub-unit, so all amounts shown to the user are whole đồng.
const formatVnd = (amount) => `${Math.round(Number(amount) || 0).toLocaleString('vi-VN')}₫`;
const formatPaymentDestination = (destination) => (
  destination === 'personal_account' ? 'Personal account'
    : destination === 'shop_account' ? 'Shop account'
      : 'Cash'
);
const formatAppointmentTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : date.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
};
const localDateInputValue = () => {
  const now = new Date();
  const local = new Date(now.getTime() - (now.getTimezoneOffset() * 60 * 1000));
  return local.toISOString().slice(0, 10);
};

const wrapCanvasText = (context, text, maxWidth) => {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
};

// Product photos live in public/Images/cutouts as transparent PNGs, so they
// can be used without putting visual assets into the database.
const productImagePaths = {
  'Kodacolor 200|36': '/Images/cutouts/Kodacolor 200.png',
  // Fuji’s white carton is part of its packaging, so retain the original image
  // rather than treating that white product area as removable background.
  'Fuji 400|36': '/Images/fuji 400.jpg',
  'Proimage 100|36': '/Images/cutouts/Proimage 100-cropped.png',
  'Ultramax 400|36': '/Images/cutouts/Ultramax - 36-cropped.png',
  'Portra 800|36': '/Images/cutouts/Portra 800.png',
  'Portra 400|36': '/Images/cutouts/Portra 400.png',
  'Gold 200|36': '/Images/cutouts/Gold-36.png',
  'Ektar 100|36': '/Images/cutouts/Ektar 100.png',
  'Tmax P3200|36': '/Images/cutouts/Tmax P3200.png',
  'Tmax 100|36': '/Images/cutouts/Tmax 100-cropped.png',
  'Ektachrome 100|36': '/Images/cutouts/Ektachrom 100.png',
  'Tmax 400|36': '/Images/cutouts/Tmax 400.png',
  'TriX 400|36': '/Images/cutouts/TriX 400.png',
  'Lomo 92|36': '/Images/cutouts/Lomo 92.png',
  'Colorplus 200|36': '/Images/cutouts/colorplus.png',
  'Portra 160|36': '/Images/cutouts/Portra 160.png',
  'Ultramax|24': '/Images/cutouts/Ultramax - 24.png',
  'Lomo 92 sun-kissed|36': '/Images/cutouts/Lomo 92 sun-kissed.png',
  'Gold 200|24': '/Images/cutouts/Gold-24.png',
};

const productImagePath = (product) => {
  const path = productImagePaths[`${product.name}|${product.exposures}`];
  return path ? `${path}?v=5` : undefined;
};

const navigationItems = [
  { id: 'create', label: 'Create Order', activeClass: 'border-terracotta bg-terracotta/10 text-terracotta' },
  { id: 'products', label: 'Products', activeClass: 'border-sepia bg-sepia/10 text-sepia' },
  { id: 'stock', label: 'Stock', activeClass: 'border-olive bg-olive/10 text-olive' },
  { id: 'orders', label: 'Order History', activeClass: 'border-plum bg-plum/10 text-plum' },
  { id: 'finance', label: 'Finance', activeClass: 'border-terracotta bg-terracotta/10 text-terracotta' },
  { id: 'payments', label: 'Payments', activeClass: 'border-olive bg-olive/10 text-olive' },
];

const quickLinks = [
  { label: 'Facebook', shortLabel: 'f', href: 'https://www.facebook.com/messages/t/1329752612112933/', className: 'bg-[#1877F2] hover:bg-[#166FE5]' },
  { label: 'Instagram', shortLabel: 'ig', href: 'https://www.instagram.com/direct/inbox/', className: 'bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#FCAF45] hover:brightness-95' },
  { label: 'Threads', shortLabel: '@', href: 'https://www.threads.com/messages', className: 'bg-plum hover:bg-[#683049]' },
  { label: 'Manual report', shortLabel: '↗', href: 'https://docs.google.com/spreadsheets/d/1QTS-AZygO2BdB5G8BWHyXZrqO8zNRlqa6c5ppGoKVy0/edit?gid=2124391194#gid=2124391194', className: 'bg-olive hover:bg-[#455B25]' },
];

function App() {
  const [products, setProducts] = useState([]);
  const [activePage, setActivePage] = useState('create');
  const [cart, setCart] = useState({});
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerLink, setCustomerLink] = useState('');
  const [customerProfiles, setCustomerProfiles] = useState([]);
  const [customerSuggestionsOpen, setCustomerSuggestionsOpen] = useState(false);
  const [orderDiscount, setOrderDiscount] = useState('');
  const [fulfillmentMethod, setFulfillmentMethod] = useState('offline');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [paymentDestination, setPaymentDestination] = useState('personal_account');
  const [message, setMessage] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [receiptCopied, setReceiptCopied] = useState(false);
  const [downloadingReceipt, setDownloadingReceipt] = useState(false);
  const [stockReport, setStockReport] = useState(null);
  const [selectedReportMonth, setSelectedReportMonth] = useState('');
  const [reportLoading, setReportLoading] = useState(true);
  const [financeReport, setFinanceReport] = useState([]);
  const [financeLoading, setFinanceLoading] = useState(true);
  const [paymentReport, setPaymentReport] = useState([]);
  const [paymentLoading, setPaymentLoading] = useState(true);
  const [orderHistory, setOrderHistory] = useState(null);
  const [selectedOrderMonth, setSelectedOrderMonth] = useState('');
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [editingOrder, setEditingOrder] = useState(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [deletingOrderId, setDeletingOrderId] = useState(null);
  const [cancellingOrderId, setCancellingOrderId] = useState(null);
  const [inventoryActionLoading, setInventoryActionLoading] = useState(false);
  const [receiptForm, setReceiptForm] = useState({ productId: '', quantity: '', unitCost: '', receivedAt: localDateInputValue() });
  const [personalUsageForm, setPersonalUsageForm] = useState({ productId: '', quantity: '', occurredAt: localDateInputValue(), note: '' });
  const [productForm, setProductForm] = useState({ name: '', exposures: '', price: '' });
  const [creatingProduct, setCreatingProduct] = useState(false);
  const cartPanelRef = useRef(null);
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(Boolean(supabase));
  const [authEmail, setAuthEmail] = useState('');
  const [authNotice, setAuthNotice] = useState(null);
  const [sendingMagicLink, setSendingMagicLink] = useState(false);

  const apiFetch = async (path, options = {}) => {
    const headers = new Headers(options.headers);
    if (supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) headers.set('authorization', `Bearer ${session.access_token}`);
    }
    return fetch(`${apiBaseUrl}${path}`, { ...options, headers });
  };

  const loadProducts = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/api/products');
      if (!response.ok) throw new Error('Unable to load products.');
      setProducts(await response.json());
    } catch {
      setMessage({ type: 'error', text: 'Không thể tải tồn kho. Hãy kiểm tra backend.' });
    } finally {
      setLoading(false);
    }
  };

  const loadStockReport = async (month) => {
    setReportLoading(true);
    try {
      const query = month ? `?month=${encodeURIComponent(month)}` : '';
      const response = await apiFetch(`/api/reports/monthly-stock${query}`);
      if (!response.ok) throw new Error('Unable to load monthly stock.');
      const report = await response.json();
      setStockReport(report);
      setSelectedReportMonth(report.monthStart || '');
    } catch {
      setMessage({ type: 'error', text: 'Không thể tải báo cáo tồn kho theo tháng.' });
    } finally {
      setReportLoading(false);
    }
  };

  const loadFinanceReport = async () => {
    setFinanceLoading(true);
    try {
      const response = await apiFetch('/api/reports/monthly-finance');
      if (!response.ok) throw new Error('Unable to load monthly finance.');
      setFinanceReport(await response.json());
    } catch {
      setMessage({ type: 'error', text: 'Không thể tải báo cáo tài chính theo tháng.' });
    } finally {
      setFinanceLoading(false);
    }
  };

  const loadPaymentReport = async () => {
    setPaymentLoading(true);
    try {
      const response = await apiFetch('/api/reports/monthly-payments');
      if (!response.ok) throw new Error('Unable to load monthly payments.');
      setPaymentReport(await response.json());
    } catch {
      setMessage({ type: 'error', text: 'Không thể tải báo cáo thanh toán theo tháng.' });
    } finally {
      setPaymentLoading(false);
    }
  };

  const loadOrderHistory = async (month) => {
    setOrdersLoading(true);
    try {
      const query = month ? `?month=${encodeURIComponent(month)}` : '';
      const response = await apiFetch(`/api/orders${query}`);
      if (!response.ok) throw new Error('Unable to load order history.');
      const history = await response.json();
      setOrderHistory(history);
      setSelectedOrderMonth(history.monthStart || '');
    } catch {
      setMessage({ type: 'error', text: 'Không thể tải lịch sử đơn hàng.' });
    } finally {
      setOrdersLoading(false);
    }
  };

  const loadCustomerProfiles = async () => {
    try {
      const response = await apiFetch('/api/customers');
      if (!response.ok) throw new Error('Unable to load customer profiles.');
      setCustomerProfiles(await response.json());
    } catch {
      // Customer lookup is optional; checkout remains available if it cannot load.
    }
  };

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return undefined;
    }
    let active = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (active) {
        setAuthUser(session?.user ?? null);
        setAuthLoading(false);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
      setAuthLoading(false);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (supabase && !authUser) return;
    loadProducts();
    loadStockReport();
    loadFinanceReport();
    loadPaymentReport();
    loadOrderHistory();
    loadCustomerProfiles();
  }, [authUser]);

  // Successful actions should confirm what happened, then get out of the way.
  useEffect(() => {
    if (!message || message.type !== 'success') return undefined;
    const timeout = window.setTimeout(() => setMessage(null), 30_000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  const cartLines = useMemo(
    () => products
      .filter((product) => cart[product.id])
      .map((product) => ({ ...product, quantity: cart[product.id] })),
    [cart, products],
  );
  const subtotal = cartLines.reduce((sum, line) => sum + (line.price * line.quantity), 0);
  const enteredDiscount = Number(orderDiscount || 0);
  const total = Math.max(0, subtotal - (Number.isFinite(enteredDiscount) ? enteredDiscount : 0));
  const totalRolls = cartLines.reduce((sum, line) => sum + line.quantity, 0);
  const financeChartMonths = useMemo(
    () => [...financeReport].reverse().slice(-12),
    [financeReport],
  );
  const financeChartMaximum = useMemo(
    () => Math.max(1, ...financeChartMonths.map((month) => Math.max(month.revenue, month.known_gross_profit))),
    [financeChartMonths],
  );

  const receiptText = receipt && [
    'Makeitgrain xác nhận đơn hàng thành công:',
    `- Khách hàng: ${receipt.customerName || '—'}`,
    receipt.fulfillmentMethod === 'online'
      ? `- Thông tin mua hàng: ${receipt.phoneNumber} - ${receipt.address}`
      : `- Giờ hẹn: ${formatAppointmentTime(receipt.appointmentTime)}`,
    '- Sản phẩm:',
    ...receipt.items.map((item) => `  • ${item.name} (${item.exposures} exp) × ${item.quantity}`),
    ...(receipt.discount > 0 ? [`- Giảm giá: ${formatVnd(receipt.discount)}`] : []),
    `- Thành tiền: ${formatVnd(receipt.totalAmount)}`,
    '',
    'Vui lòng thanh toán theo số tài khoản hoặc QR bên dưới:',
    'Số tài khoản: 25818101999 VP Bank Nguyễn Phương Thảo',
  ].join('\n');

  const changeQuantity = (product, change) => {
    setMessage(null);
    setCart((currentCart) => {
      const nextQuantity = (currentCart[product.id] || 0) + change;
      if (nextQuantity <= 0) {
        const { [product.id]: _removed, ...nextCart } = currentCart;
        return nextCart;
      }
      if (nextQuantity > product.stock) {
        setMessage({ type: 'error', text: `${product.name} only has ${product.stock} rolls in stock.` });
        return currentCart;
      }
      return { ...currentCart, [product.id]: nextQuantity };
    });
  };

  const customerSuggestions = customerName.trim()
    ? customerProfiles.filter((profile) => profile.customerName?.toLocaleLowerCase().includes(customerName.trim().toLocaleLowerCase())).slice(0, 6)
    : [];

  const chooseCustomer = (profile) => {
    setCustomerName(profile.customerName || '');
    setCustomerLink(profile.customerLink || '');
    setPhoneNumber(profile.phoneNumber || '');
    setAddress(profile.address || '');
    setCustomerSuggestionsOpen(false);
  };

  const submitCheckout = async (event) => {
    event.preventDefault();
    if (cartLines.length === 0) {
      setMessage({ type: 'error', text: 'Thêm ít nhất một cuộn phim vào giỏ hàng.' });
      return;
    }

    setCheckingOut(true);
    setMessage(null);
    try {
      const response = await apiFetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          customerName,
          customerLink,
          discount: orderDiscount === '' ? 0 : Number(orderDiscount),
          fulfillmentMethod,
          appointmentTime,
          phoneNumber,
          address,
          paymentMethod,
          paymentDestination: paymentMethod === 'bank_transfer' ? paymentDestination : null,
          items: cartLines.map(({ id, quantity }) => ({ productId: id, quantity })),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Không thể hoàn tất đơn hàng.');

      setReceipt({
        orderId: result.orderId,
        customerName,
        fulfillmentMethod,
        appointmentTime,
        phoneNumber,
        address,
        items: cartLines.map(({ name, exposures, quantity }) => ({ name, exposures, quantity })),
        discount: orderDiscount === '' ? 0 : Number(orderDiscount),
        totalAmount: result.totalAmount,
      });
      setReceiptCopied(false);
      setCart({});
      setCustomerName('');
      setCustomerLink('');
      setOrderDiscount('');
      setFulfillmentMethod('offline');
      setAppointmentTime('');
      setPhoneNumber('');
      setAddress('');
      setMessage({
        type: 'success',
        text: `Đã tạo đơn #${result.orderId} — ${formatVnd(result.totalAmount)}.${result.costStatus === 'pending' ? ' Giá vốn đang chờ xác nhận.' : ''}`,
      });
      const orderMonth = `${result.orderDate.slice(0, 7)}-01`;
      await Promise.all([
        loadProducts(),
        loadOrderHistory(orderMonth),
        loadStockReport(orderMonth),
        loadFinanceReport(),
        loadPaymentReport(),
      ]);
      setActivePage('orders');
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setCheckingOut(false);
    }
  };

  const copyReceipt = async () => {
    if (!receiptText) return;
    try {
      await navigator.clipboard.writeText(receiptText);
      setReceiptCopied(true);
    } catch {
      setMessage({ type: 'error', text: 'Không thể sao chép tự động. Hãy chọn và sao chép nội dung trong cửa sổ xác nhận.' });
    }
  };

  const downloadReceiptImage = async () => {
    if (!receipt) return;
    setDownloadingReceipt(true);
    try {
      const qrImage = new Image();
      qrImage.src = '/Images/payment-qr.jpg';
      await qrImage.decode();

      const width = 1080;
      const padding = 72;
      const contentWidth = width - (padding * 2);
      const draft = document.createElement('canvas');
      draft.width = width;
      draft.height = 2400;
      const context = draft.getContext('2d');
      if (!context) throw new Error('Your browser cannot create the receipt image.');

      context.fillStyle = '#fffdf9';
      context.fillRect(0, 0, width, draft.height);
      let y = padding;
      const drawText = (text, { font = '36px Arial', color = '#28251f', gap = 20 } = {}) => {
        context.font = font;
        context.fillStyle = color;
        const fontSize = Number(font.match(/(\d+)px/)?.[1] || 36);
        const lineHeight = Math.ceil(fontSize * 1.42);
        for (const line of wrapCanvasText(context, text, contentWidth)) {
          context.fillText(line, padding, y);
          y += lineHeight;
        }
        y += gap;
      };

      drawText('MAKE IT GRAIN', { font: 'bold 28px Arial', color: '#785228', gap: 14 });
      drawText('Xác nhận đơn hàng thành công', { font: 'bold 48px Arial', gap: 40 });
      drawText(`• Khách hàng: ${receipt.customerName || '—'}`);
      drawText(receipt.fulfillmentMethod === 'online'
        ? `• Thông tin mua hàng: ${receipt.phoneNumber} - ${receipt.address}`
        : `• Giờ hẹn: ${formatAppointmentTime(receipt.appointmentTime)}`);
      drawText('• Sản phẩm:', { gap: 10 });
      for (const item of receipt.items) drawText(`   • ${item.name} (${item.exposures} exp) × ${item.quantity}`, { gap: 8 });
      y += 12;
      if (receipt.discount > 0) drawText(`• Giảm giá: ${formatVnd(receipt.discount)}`);
      const totalFontSize = 42;
      const totalLineHeight = Math.ceil(totalFontSize * 1.42);
      context.fillStyle = '#f7e3dc';
      context.fillRect(padding, y - totalFontSize - 12, contentWidth, totalLineHeight + 20);
      drawText(`• Thành tiền: ${formatVnd(receipt.totalAmount)}`, { font: 'bold 42px Arial', color: '#a8402e', gap: 38 });
      context.fillStyle = '#ddd5c9';
      context.fillRect(padding, y, contentWidth, 2);
      y += 42;
      drawText('Vui lòng thanh toán theo số tài khoản hoặc QR bên dưới:', { gap: 12 });
      drawText('Số tài khoản: 25818101999', { font: 'bold 36px Arial', gap: 8 });
      drawText('VP Bank · Nguyễn Phương Thảo', { gap: 32 });

      const qrSize = 360;
      const qrX = (width - qrSize) / 2;
      context.drawImage(qrImage, qrX, y, qrSize, qrSize);
      y += qrSize + padding;

      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = width;
      finalCanvas.height = Math.ceil(y);
      finalCanvas.getContext('2d').drawImage(draft, 0, 0);
      finalCanvas.toBlob((blob) => {
        if (!blob) {
          setMessage({ type: 'error', text: 'Không thể tạo ảnh xác nhận đơn hàng.' });
          setDownloadingReceipt(false);
          return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `makeitgrain-order-${receipt.orderId}.png`;
        link.click();
        URL.revokeObjectURL(url);
        setDownloadingReceipt(false);
      }, 'image/png');
    } catch {
      setMessage({ type: 'error', text: 'Không thể tải QR để tạo ảnh xác nhận.' });
      setDownloadingReceipt(false);
    }
  };

  const deleteOrder = async (order) => {
    const confirmed = window.confirm(`Delete order #${order.id}? Its stock and payment record will be restored and removed.`);
    if (!confirmed) return;

    setDeletingOrderId(order.id);
    setMessage(null);
    try {
      const response = await apiFetch(`/api/orders/${order.id}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to delete order.');
      if (editingOrder?.id === order.id) setEditingOrder(null);
      setMessage({ type: 'success', text: `Order #${result.orderId} deleted. Stock has been restored.` });
      await Promise.all([loadProducts(), loadOrderHistory(selectedOrderMonth), loadStockReport(selectedReportMonth), loadFinanceReport(), loadPaymentReport()]);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setDeletingOrderId(null);
    }
  };

  const cancelOrder = async (order) => {
    const confirmed = window.confirm(`Cancel order #${order.id}? Its stock will be restored and its payment removed. The order record will be kept for audit.`);
    if (!confirmed) return;
    setCancellingOrderId(order.id);
    setMessage(null);
    try {
      const response = await apiFetch(`/api/orders/${order.id}/cancel`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to cancel order.');
      if (editingOrder?.id === order.id) setEditingOrder(null);
      setMessage({ type: 'success', text: `Order #${result.orderId} cancelled. Stock has been restored.` });
      await Promise.all([loadProducts(), loadOrderHistory(selectedOrderMonth), loadStockReport(selectedReportMonth), loadFinanceReport(), loadPaymentReport()]);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setCancellingOrderId(null);
    }
  };

  const refreshInventoryViews = async (date) => {
    const reportMonth = `${date.slice(0, 7)}-01`;
    await Promise.all([loadProducts(), loadStockReport(reportMonth)]);
  };

  const submitReceipt = async (event) => {
    event.preventDefault();
    setInventoryActionLoading(true);
    setMessage(null);
    try {
      const response = await apiFetch('/api/inventory/receipts', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          productId: Number(receiptForm.productId),
          quantity: Number(receiptForm.quantity),
          unitCost: Number(receiptForm.unitCost),
          receivedAt: receiptForm.receivedAt,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to receive inventory.');
      setMessage({ type: 'success', text: `${result.quantity} rolls of ${result.productName} received into a new batch.` });
      setReceiptForm({ productId: '', quantity: '', unitCost: '', receivedAt: localDateInputValue() });
      await refreshInventoryViews(receiptForm.receivedAt);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setInventoryActionLoading(false);
    }
  };

  const submitPersonalUsage = async (event) => {
    event.preventDefault();
    setInventoryActionLoading(true);
    setMessage(null);
    try {
      const response = await apiFetch('/api/inventory/personal-usage', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          productId: Number(personalUsageForm.productId),
          quantity: Number(personalUsageForm.quantity),
          occurredAt: personalUsageForm.occurredAt,
          note: personalUsageForm.note,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to record personal usage.');
      setMessage({ type: 'success', text: `${result.quantity} rolls of ${result.productName} recorded as personal use.` });
      setPersonalUsageForm({ productId: '', quantity: '', occurredAt: localDateInputValue(), note: '' });
      await refreshInventoryViews(personalUsageForm.occurredAt);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setInventoryActionLoading(false);
    }
  };

  const submitProduct = async (event) => {
    event.preventDefault();
    setCreatingProduct(true);
    setMessage(null);
    try {
      const response = await apiFetch('/api/products', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: productForm.name, exposures: Number(productForm.exposures), price: Number(productForm.price) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to create product.');
      setMessage({ type: 'success', text: `${result.name} (${result.exposures} exp) added to the catalog.` });
      setProductForm({ name: '', exposures: '', price: '' });
      await loadProducts();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setCreatingProduct(false);
    }
  };

  const beginOrderEdit = (order) => {
    setMessage(null);
    setEditingOrder({
      id: order.id,
      customerName: order.customer_name || '',
      paymentMethod: order.payment_method || 'cash',
      paymentDestination: order.payment_destination || 'shop_account',
      discount: order.discount || 0,
      changeNote: '',
      items: order.items.map((item) => ({ productId: item.productId, quantity: item.quantity, unitPrice: item.unitPrice })),
    });
  };

  const updateEditItem = (index, patch) => setEditingOrder((current) => ({
    ...current,
    items: current.items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
  }));

  const saveOrderEdit = async (event) => {
    event.preventDefault();
    setSavingOrder(true);
    setMessage(null);
    try {
      const response = await apiFetch(`/api/orders/${editingOrder.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...editingOrder,
          discount: Number(editingOrder.discount),
          items: editingOrder.items.map((item) => ({
            productId: Number(item.productId), quantity: Number(item.quantity), unitPrice: Number(item.unitPrice),
          })),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to update order.');
      setEditingOrder(null);
      setMessage({ type: 'success', text: `Order #${result.orderId} updated — ${formatVnd(result.totalAmount)}.` });
      await Promise.all([loadProducts(), loadOrderHistory(selectedOrderMonth), loadStockReport(selectedReportMonth), loadFinanceReport(), loadPaymentReport()]);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSavingOrder(false);
    }
  };

  const requestMagicLink = async (event) => {
    event.preventDefault();
    if (!supabase) return;
    setSendingMagicLink(true);
    setAuthNotice(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: authEmail.trim(),
      options: {
        emailRedirectTo: window.location.origin,
        shouldCreateUser: false,
      },
    });
    setSendingMagicLink(false);
    setAuthNotice(error
      ? { type: 'error', text: error.message }
      : { type: 'success', text: 'Check your email and open the secure sign-in link.' });
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setAuthNotice(null);
  };

  if (authLoading) {
    return <div className="grid min-h-screen place-items-center bg-white p-6 text-sm text-ink/60">Checking your secure session…</div>;
  }

  if (!supabase && !import.meta.env.DEV) {
    return <div className="grid min-h-screen place-items-center bg-white p-6 text-center text-sm text-terracotta">This deployment is missing its Supabase sign-in configuration.</div>;
  }

  if (supabase && !authUser) {
    return (
      <main className="grid min-h-screen place-items-center bg-white p-5">
        <section className="w-full max-w-sm border border-ink/20 bg-white p-6 shadow-sm">
          <img src="/Images/makeitgrain-logo-cropped.png" alt="Make It Grain" className="mx-auto h-24 w-auto object-contain" />
          <h1 className="mt-5 text-center text-lg font-medium uppercase tracking-wide">Private workspace</h1>
          <p className="mt-2 text-center text-sm leading-6 text-ink/60">Enter your owner email. We will send a secure sign-in link—no password is needed.</p>
          <form onSubmit={requestMagicLink} className="mt-6">
            <label className="block text-sm">
              Email address
              <input type="email" required value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} className="mt-1 w-full border border-ink/20 bg-paper px-3 py-3 outline-none focus:border-sepia" placeholder="you@example.com" autoComplete="email" />
            </label>
            <button type="submit" disabled={sendingMagicLink} className="mt-4 w-full bg-ink px-4 py-3 text-sm uppercase tracking-wider text-paper disabled:opacity-50">{sendingMagicLink ? 'Sending…' : 'Email me a sign-in link'}</button>
          </form>
          {authNotice && <p className={`mt-4 border px-3 py-2 text-sm ${authNotice.type === 'error' ? 'border-terracotta/40 bg-terracotta/10 text-terracotta' : 'border-olive/40 bg-olive/10 text-olive'}`}>{authNotice.text}</p>}
        </section>
      </main>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-7xl px-3 py-4 sm:px-5 sm:py-8 lg:px-8">
      <header className="sticky top-0 z-40 mb-5 border-b border-ink/15 bg-white/95 px-2 pt-2 shadow-sm backdrop-blur sm:mb-8 sm:px-3 sm:pt-3">
        <div className="flex items-center justify-between gap-3 pb-3 sm:gap-4 sm:pb-5">
          <div>
            <img src="/Images/makeitgrain-logo-cropped.png" alt="Make It Grain" className="h-16 w-auto object-contain object-left sm:h-20" />
          </div>
          <div className="flex flex-wrap justify-end gap-1.5 sm:gap-2 sm:pt-3" aria-label="Quick links">
            {quickLinks.map((link) => (
              <a key={link.label} href={link.href} target="_blank" rel="noreferrer" title={link.label} aria-label={link.label} className={`inline-flex size-10 items-center justify-center rounded-full text-xs font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow ${link.className}`}>
                {link.shortLabel}
              </a>
            ))}
            {supabase && <button type="button" onClick={signOut} className="inline-flex h-10 items-center justify-center rounded-full border border-ink/20 px-3 text-xs font-medium text-ink transition hover:bg-paper">Sign out</button>}
          </div>
        </div>
        <nav aria-label="Main navigation" className="-mx-2 flex overflow-x-auto border-t border-ink/10 bg-white sm:-mx-3">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActivePage(item.id)}
              className={`shrink-0 border-b-2 px-3 py-3 text-xs uppercase tracking-wider transition sm:px-4 sm:text-sm ${activePage === item.id ? item.activeClass : 'border-transparent text-ink/55 hover:border-ink/20 hover:bg-paper hover:text-ink'}`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      {message && (
        <div className={`flex items-center justify-between gap-3 border px-3 py-3 text-sm sm:px-4 ${message.type === 'success' ? 'border-olive/40 bg-olive/10 text-olive' : 'border-terracotta/40 bg-terracotta/10 text-terracotta'}`} role="status">
          <span>{message.text}</span>
          <button type="button" onClick={() => setMessage(null)} className="shrink-0 text-lg leading-none opacity-70 transition hover:opacity-100" aria-label="Dismiss message">×</button>
        </div>
      )}

      {receipt && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 sm:items-center sm:p-5" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="receipt-title" className="max-h-[92vh] w-full max-w-lg overflow-y-auto border border-ink/20 bg-white p-4 shadow-xl sm:max-h-[90vh] sm:p-6">
            <div className="flex items-start justify-between gap-4 border-b border-ink/10 pb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-sepia">Order confirmed</p>
                <h2 id="receipt-title" className="mt-1 text-xl font-medium">Makeitgrain xác nhận đơn hàng thành công</h2>
              </div>
              <button type="button" onClick={() => setReceipt(null)} aria-label="Close confirmation" className="text-2xl leading-none text-ink/60 hover:text-ink">×</button>
            </div>
            <div className="space-y-4 py-5 text-sm leading-6">
              <p><span className="font-medium">Khách hàng:</span> {receipt.customerName || '—'}</p>
              {receipt.fulfillmentMethod === 'online' ? (
                <p><span className="font-medium">Thông tin mua hàng:</span> {receipt.phoneNumber} - {receipt.address}</p>
              ) : (
                <p><span className="font-medium">Giờ hẹn:</span> {formatAppointmentTime(receipt.appointmentTime)}</p>
              )}
              <div>
                <p className="font-medium">Sản phẩm:</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {receipt.items.map((item) => <li key={`${item.name}-${item.exposures}`}>{item.name} ({item.exposures} exp) × {item.quantity}</li>)}
                </ul>
              </div>
              {receipt.discount > 0 && <p><span className="font-medium">Giảm giá:</span> {formatVnd(receipt.discount)}</p>}
              <p className="border-y border-terracotta/25 bg-terracotta/10 px-3 py-2 text-lg font-medium text-terracotta"><span className="text-sm">Thành tiền: </span>{formatVnd(receipt.totalAmount)}</p>
              <div className="border-t border-ink/10 pt-4">
                <p>Vui lòng thanh toán theo số tài khoản hoặc QR bên dưới:</p>
                <p className="mt-2 font-medium">Số tài khoản: 25818101999</p>
                <p>VP Bank · Nguyễn Phương Thảo</p>
                <img src="/Images/payment-qr.jpg" alt="QR code for VP Bank account 25818101999" className="mx-auto mt-4 w-48 border border-ink/10 p-1" />
              </div>
            </div>
            <div className="grid gap-2 border-t border-ink/10 pt-4 sm:flex sm:flex-wrap sm:justify-end sm:gap-3">
              <button type="button" onClick={() => setReceipt(null)} className="border border-ink/25 px-4 py-3 text-sm">Close</button>
              <button type="button" onClick={copyReceipt} className="bg-ink px-4 py-3 text-sm text-paper">{receiptCopied ? 'Copied' : 'Copy message'}</button>
              <button type="button" onClick={downloadReceiptImage} disabled={downloadingReceipt} className="bg-sepia px-4 py-3 text-sm text-paper disabled:opacity-50">{downloadingReceipt ? 'Creating image…' : 'Download image'}</button>
            </div>
          </section>
        </div>
      )}

      {activePage === 'create' && <main className="grid gap-5 lg:gap-8 lg:grid-cols-[1fr_360px]">
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-medium uppercase tracking-wide">Available film</h2>
            <button type="button" onClick={loadProducts} className="text-sm text-sepia underline underline-offset-4">Refresh stock</button>
          </div>

          {loading ? (
            <div className="py-16 text-center text-ink/60 animate-pulse">Đang tải danh sách phim...</div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
              {products.map((product) => {
                const inCart = cart[product.id] || 0;
                const unavailable = product.stock === 0;
                const imagePath = productImagePath(product);
                return (
                  <article key={product.id} className="flex min-h-0 flex-col justify-between overflow-hidden border border-ink/20 bg-white shadow-sm sm:min-h-64">
                    {imagePath && (
                      <div className="flex h-24 items-center justify-center overflow-hidden bg-paper px-2 pt-2 sm:h-44 sm:px-5 sm:pt-4">
                        <img
                          src={imagePath}
                          alt={`${product.name}, ${product.exposures} exposure film`}
                          className="h-full w-full object-contain"
                        />
                      </div>
                    )}
                    <div className="flex flex-1 flex-col justify-between p-3 sm:p-5">
                    <div>
                      <div className="mb-2 flex items-start justify-between gap-1.5 sm:mb-4 sm:gap-3">
                        <h3 className="text-sm font-medium leading-5 text-ink sm:text-lg">{product.name}</h3>
                        <span className="shrink-0 rounded-full border border-ink/10 bg-paper px-1.5 py-0.5 text-[10px] uppercase text-sepia sm:px-2 sm:py-1 sm:text-xs">{product.format}</span>
                      </div>
                      <p className="text-lg font-light text-ink sm:text-2xl">{formatVnd(product.price)}</p>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-ink/10 pt-3 sm:mt-6 sm:gap-3 sm:pt-4">
                      <span className={`text-[11px] sm:text-sm ${product.stock > 5 ? 'text-olive' : 'text-terracotta'}`}>Kho: {product.stock} cuộn</span>
                      <button
                        type="button"
                        disabled={unavailable}
                        onClick={() => changeQuantity(product, 1)}
                        className="border border-ink px-2 py-2 text-[10px] uppercase tracking-wide transition hover:bg-ink hover:text-paper sm:px-3 sm:text-xs sm:tracking-wider disabled:cursor-not-allowed disabled:border-ink/20 disabled:text-ink/30 disabled:hover:bg-transparent"
                      >
                        {unavailable ? 'Hết hàng' : inCart ? `+ Thêm (${inCart})` : '+ Giỏ hàng'}
                      </button>
                    </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <aside ref={cartPanelRef} className="h-fit border border-ink/20 bg-white p-4 shadow-sm sm:p-5 lg:sticky lg:top-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-lg font-medium uppercase tracking-wide">Order details</h2>
            <span className="text-sm text-ink/60">Giỏ hàng: {totalRolls} cuộn</span>
          </div>
          {cartLines.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink/50">Chưa có sản phẩm trong giỏ.</p>
          ) : (
            <div className="space-y-4">
              {cartLines.map((line) => (
                <div key={line.id} className="border-b border-ink/10 pb-4">
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="font-medium">{line.name}</span>
                    <span>{formatVnd(line.price * line.quantity)}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-ink/50">{formatVnd(line.price)} / roll</span>
                    <div className="flex items-center border border-ink/20">
                      <button type="button" aria-label={`Remove one ${line.name}`} onClick={() => changeQuantity(line, -1)} className="px-3 py-1 text-lg">−</button>
                      <span className="min-w-8 text-center text-sm">{line.quantity}</span>
                      <button type="button" aria-label={`Add one ${line.name}`} onClick={() => changeQuantity(line, 1)} className="px-3 py-1 text-lg">+</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={submitCheckout} className="mt-6 space-y-4">
            <div className="grid gap-3">
              <div className="relative text-sm">
                <label className="block">
                  Customer name <span className="text-ink/40">(optional)</span>
                  <input
                    value={customerName}
                    onChange={(event) => { setCustomerName(event.target.value); setCustomerSuggestionsOpen(true); }}
                    onFocus={() => setCustomerSuggestionsOpen(true)}
                    className="mt-1 w-full border border-ink/20 bg-paper px-3 py-2 outline-none focus:border-sepia"
                    autoComplete="off"
                  />
                </label>
                {customerSuggestionsOpen && customerSuggestions.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full overflow-hidden border border-ink/20 bg-white shadow-lg">
                    {customerSuggestions.map((profile, index) => (
                      <button
                        key={`${profile.customerName}-${profile.customerLink}-${index}`}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => chooseCustomer(profile)}
                        className="block w-full border-b border-ink/10 px-3 py-2 text-left last:border-b-0 hover:bg-paper"
                      >
                        {profile.customerName}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <label className="block text-sm">
                Customer link <span className="text-ink/40">(optional)</span>
                <input value={customerLink} onChange={(event) => setCustomerLink(event.target.value)} className="mt-1 w-full border border-ink/20 bg-paper px-3 py-2 outline-none focus:border-sepia" />
              </label>
            </div>
            <fieldset className="border border-ink/20 p-3">
              <legend className="px-1 text-sm">Order type</legend>
              <div className="flex gap-5 text-sm">
                <label className="flex items-center gap-2"><input type="radio" name="fulfillment" value="offline" checked={fulfillmentMethod === 'offline'} onChange={() => setFulfillmentMethod('offline')} /> Offline</label>
                <label className="flex items-center gap-2"><input type="radio" name="fulfillment" value="online" checked={fulfillmentMethod === 'online'} onChange={() => setFulfillmentMethod('online')} /> Online</label>
              </div>
              {fulfillmentMethod === 'offline' ? (
                <label className="mt-3 block text-sm">
                  Appointment time
                  <input type="datetime-local" required value={appointmentTime} onChange={(event) => setAppointmentTime(event.target.value)} className="mt-1 w-full border border-ink/20 bg-paper px-3 py-2 outline-none focus:border-sepia" />
                </label>
              ) : (
                <div className="mt-3 grid gap-3">
                  <label className="block text-sm">Phone number<input type="tel" required value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} className="mt-1 w-full border border-ink/20 bg-paper px-3 py-2 outline-none focus:border-sepia" /></label>
                  <label className="block text-sm">Address<textarea required value={address} onChange={(event) => setAddress(event.target.value)} rows="2" className="mt-1 w-full border border-ink/20 bg-paper px-3 py-2 outline-none focus:border-sepia" /></label>
                </div>
              )}
            </fieldset>
            <label className="block text-sm">
              Discount (VND) <span className="text-ink/40">(optional)</span>
              <input type="number" min="0" step="1" value={orderDiscount} onChange={(event) => setOrderDiscount(event.target.value)} className="mt-1 w-full border border-ink/20 bg-paper px-3 py-2 outline-none focus:border-sepia" />
            </label>
            <label className="block text-sm">
              Payment method
              <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="mt-1 w-full border border-ink/20 bg-paper px-3 py-2 outline-none focus:border-sepia">
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank transfer</option>
              </select>
            </label>
            {paymentMethod === 'bank_transfer' && (
              <label className="block text-sm">
                Destination account
                <select value={paymentDestination} onChange={(event) => setPaymentDestination(event.target.value)} className="mt-1 w-full border border-ink/20 bg-paper px-3 py-2 outline-none focus:border-sepia">
                  <option value="shop_account">Shop account</option>
                  <option value="personal_account">Personal account</option>
                </select>
              </label>
            )}
            <div className="flex items-end justify-between border-t border-ink/20 pt-4">
              <div>
                {enteredDiscount > 0 && <p className="text-xs text-ink/50">Subtotal {formatVnd(subtotal)} − discount {formatVnd(enteredDiscount)}</p>}
                <p className="text-xs uppercase tracking-wider text-ink/50">Total</p>
                <p className="text-2xl font-light">{formatVnd(total)}</p>
              </div>
              <button type="submit" disabled={checkingOut || cartLines.length === 0} className="bg-ink px-4 py-3 text-sm uppercase tracking-wider text-paper transition hover:bg-sepia disabled:cursor-not-allowed disabled:bg-ink/30">
                {checkingOut ? 'Processing…' : 'Checkout'}
              </button>
            </div>
          </form>
        </aside>
      </main>}

      {activePage === 'create' && totalRolls > 0 && (
        <button
          type="button"
          onClick={() => cartPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="fixed inset-x-3 bottom-3 z-30 flex items-center justify-between bg-ink px-4 py-3 text-sm text-paper shadow-lg lg:hidden"
        >
          <span>{totalRolls} roll{totalRolls === 1 ? '' : 's'} in cart</span>
          <span className="font-medium uppercase tracking-wide">View order →</span>
        </button>
      )}

      {activePage === 'products' && <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <form onSubmit={submitProduct} className="h-fit border border-ink/20 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-medium uppercase tracking-wide">Add film</h2>
          <p className="mt-1 text-sm text-ink/55">Add a product before receiving its first inventory batch.</p>
          <div className="mt-5 space-y-4">
            <label className="block text-sm">Film name<input required value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} className="mt-1 w-full border border-ink/20 bg-paper px-3 py-2" placeholder="For example: Portra 400" /></label>
            <label className="block text-sm">Exposures<input required type="number" min="1" step="1" value={productForm.exposures} onChange={(event) => setProductForm({ ...productForm, exposures: event.target.value })} className="mt-1 w-full border border-ink/20 bg-paper px-3 py-2" placeholder="36" /></label>
            <label className="block text-sm">Selling price (VND)<input required type="number" min="0" step="1" value={productForm.price} onChange={(event) => setProductForm({ ...productForm, price: event.target.value })} className="mt-1 w-full border border-ink/20 bg-paper px-3 py-2" placeholder="250000" /></label>
          </div>
          <button type="submit" disabled={creatingProduct} className="mt-5 bg-ink px-4 py-3 text-sm uppercase tracking-wider text-paper disabled:opacity-50">{creatingProduct ? 'Adding…' : 'Add product'}</button>
        </form>
        <section className="border border-ink/20 bg-white p-5 shadow-sm">
          <div className="border-b border-ink/10 pb-4"><h2 className="text-lg font-medium uppercase tracking-wide">Product catalog</h2><p className="mt-1 text-sm text-ink/55">Current selling price and live remaining stock.</p></div>
          {loading ? <p className="py-10 text-center text-sm text-ink/55 animate-pulse">Loading products…</p> : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead className="border-b border-ink/20 text-xs uppercase tracking-wider text-ink/55"><tr><th className="px-2 py-3">Film</th><th className="px-2 py-3">Exposures</th><th className="px-2 py-3 text-right">Selling price</th><th className="px-2 py-3 text-right">In stock</th></tr></thead><tbody>{products.map((product) => <tr key={product.id} className="border-b border-ink/10"><td className="px-2 py-3 font-medium">{product.name}</td><td className="px-2 py-3">{product.exposures} exp</td><td className="px-2 py-3 text-right">{formatVnd(product.price)}</td><td className="px-2 py-3 text-right">{product.stock}</td></tr>)}</tbody></table></div>}
        </section>
      </section>}

      {activePage === 'stock' && <section className="border border-ink/20 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 border-b border-ink/10 pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-medium uppercase tracking-wide">Monthly stock tracker</h2>
            <p className="mt-1 text-sm text-ink/55">Opening + received − sold = closing stock</p>
          </div>
          <label className="text-sm">
            Month ending
            <select
              value={selectedReportMonth}
              onChange={(event) => loadStockReport(event.target.value)}
              disabled={reportLoading || !stockReport}
              className="ml-3 border border-ink/20 bg-paper px-3 py-2 outline-none focus:border-sepia disabled:opacity-50"
            >
              {stockReport?.months.map((month) => (
                <option key={month} value={month}>{month.slice(0, 7)}</option>
              ))}
            </select>
          </label>
        </div>

        <details className="my-5 border border-ink/20 bg-paper">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium uppercase tracking-wide marker:text-sepia">Stock actions <span className="ml-2 normal-case text-ink/50">Receive a batch or record personal use</span></summary>
          <div className="grid gap-5 border-t border-ink/10 p-4 lg:grid-cols-2">
            <form onSubmit={submitReceipt} className="border border-olive/30 bg-olive/5 p-4">
            <h3 className="font-medium uppercase tracking-wide text-olive">Receive stock</h3>
            <p className="mt-1 text-sm text-ink/55">Creates a new purchase batch for FIFO costing.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm sm:col-span-2">Film<select required value={receiptForm.productId} onChange={(event) => setReceiptForm({ ...receiptForm, productId: event.target.value })} className="mt-1 w-full border border-ink/20 bg-white px-3 py-2"><option value="">Choose a film</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} ({product.exposures} exp)</option>)}</select></label>
              <label className="text-sm">Quantity<input required type="number" min="1" step="1" value={receiptForm.quantity} onChange={(event) => setReceiptForm({ ...receiptForm, quantity: event.target.value })} className="mt-1 w-full border border-ink/20 bg-white px-3 py-2" /></label>
              <label className="text-sm">Cost / roll (VND)<input required type="number" min="0" step="1" value={receiptForm.unitCost} onChange={(event) => setReceiptForm({ ...receiptForm, unitCost: event.target.value })} className="mt-1 w-full border border-ink/20 bg-white px-3 py-2" /></label>
              <label className="text-sm sm:col-span-2">Received date<input required type="date" value={receiptForm.receivedAt} onChange={(event) => setReceiptForm({ ...receiptForm, receivedAt: event.target.value })} className="mt-1 w-full border border-ink/20 bg-white px-3 py-2" /></label>
            </div>
            <button type="submit" disabled={inventoryActionLoading} className="mt-4 bg-olive px-4 py-2 text-sm text-paper disabled:opacity-50">{inventoryActionLoading ? 'Saving…' : 'Receive stock'}</button>
            </form>

            <form onSubmit={submitPersonalUsage} className="border border-terracotta/30 bg-terracotta/5 p-4">
            <h3 className="font-medium uppercase tracking-wide text-terracotta">Personal use</h3>
            <p className="mt-1 text-sm text-ink/55">Deducts rolls from the oldest available batches and keeps the adjustment history.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm sm:col-span-2">Film<select required value={personalUsageForm.productId} onChange={(event) => setPersonalUsageForm({ ...personalUsageForm, productId: event.target.value })} className="mt-1 w-full border border-ink/20 bg-white px-3 py-2"><option value="">Choose a film</option>{products.filter((product) => product.stock > 0).map((product) => <option key={product.id} value={product.id}>{product.name} ({product.exposures} exp) — {product.stock} in stock</option>)}</select></label>
              <label className="text-sm">Quantity<input required type="number" min="1" step="1" value={personalUsageForm.quantity} onChange={(event) => setPersonalUsageForm({ ...personalUsageForm, quantity: event.target.value })} className="mt-1 w-full border border-ink/20 bg-white px-3 py-2" /></label>
              <label className="text-sm">Usage date<input required type="date" value={personalUsageForm.occurredAt} onChange={(event) => setPersonalUsageForm({ ...personalUsageForm, occurredAt: event.target.value })} className="mt-1 w-full border border-ink/20 bg-white px-3 py-2" /></label>
              <label className="text-sm sm:col-span-2">Note <span className="text-ink/40">(optional)</span><input value={personalUsageForm.note} onChange={(event) => setPersonalUsageForm({ ...personalUsageForm, note: event.target.value })} className="mt-1 w-full border border-ink/20 bg-white px-3 py-2" placeholder="For example: personal use" /></label>
            </div>
            <button type="submit" disabled={inventoryActionLoading} className="mt-4 bg-terracotta px-4 py-2 text-sm text-paper disabled:opacity-50">{inventoryActionLoading ? 'Saving…' : 'Record personal use'}</button>
            </form>
          </div>
        </details>

        {reportLoading ? (
          <p className="py-10 text-center text-sm text-ink/55 animate-pulse">Đang tải báo cáo tồn kho...</p>
        ) : stockReport && (
          <>
            <div className="my-5 grid grid-cols-2 gap-3 text-center text-sm md:grid-cols-4">
              <div className="border border-ink/10 bg-paper p-3"><p className="text-ink/50">Received</p><p className="mt-1 text-lg">{stockReport.totals.received_quantity}</p></div>
              <div className="border border-ink/10 bg-paper p-3"><p className="text-ink/50">Sold</p><p className="mt-1 text-lg">{stockReport.totals.sold_quantity}</p></div>
              <div className="border border-terracotta/30 bg-terracotta/10 p-3"><p className="text-terracotta">Personal use</p><p className="mt-1 text-lg text-terracotta">{stockReport.totals.personal_usage_quantity}</p></div>
              <div className="border border-olive/30 bg-olive/10 p-3"><p className="text-olive">Closing stock</p><p className="mt-1 text-lg text-olive">{stockReport.totals.closing_stock}</p></div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-ink/20 text-xs uppercase tracking-wider text-ink/55">
                  <tr>
                    <th className="px-2 py-3 font-medium">Film</th>
                    <th className="px-2 py-3 text-right font-medium">Opening</th>
                    <th className="px-2 py-3 text-right font-medium">Received</th>
                    <th className="px-2 py-3 text-right font-medium">Sold</th>
                    <th className="px-2 py-3 text-right font-medium">Personal use</th>
                    <th className="px-2 py-3 text-right font-medium">Closing</th>
                  </tr>
                </thead>
                <tbody>
                  {stockReport.products.map((product) => (
                    <tr key={product.product_id} className={`border-b border-ink/10 ${product.reconciliation_status !== 'ok' ? 'bg-terracotta/10 text-terracotta' : ''}`}>
                      <td className="px-2 py-3">{product.product_name} <span className="text-ink/45">({product.exposures} exp)</span></td>
                      <td className="px-2 py-3 text-right">{product.opening_stock}</td>
                      <td className="px-2 py-3 text-right">{product.received_quantity}</td>
                      <td className="px-2 py-3 text-right">{product.sold_quantity}</td>
                      <td className="px-2 py-3 text-right">{product.personal_usage_quantity}</td>
                      <td className="px-2 py-3 text-right font-medium">{product.closing_stock}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>}

      {activePage === 'finance' && <section className="border border-ink/20 bg-white p-5 shadow-sm">
        <div className="border-b border-ink/10 pb-4">
          <h2 className="text-lg font-medium uppercase tracking-wide">Monthly finance</h2>
          <p className="mt-1 text-sm text-ink/55">Gross profit only includes orders whose FIFO cost is known.</p>
        </div>
        {financeLoading ? (
          <p className="py-10 text-center text-sm text-ink/55 animate-pulse">Đang tải báo cáo tài chính...</p>
        ) : (
          <>
            <div className="mt-5 overflow-x-auto border border-ink/10 bg-paper p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-medium uppercase tracking-wide">Revenue and margin</h3>
                  <p className="mt-1 text-xs text-ink/55">Last 12 months · hover a bar for the amount</p>
                </div>
                <div className="flex gap-3 text-xs text-ink/60">
                  <span><span className="mr-1 inline-block size-2 bg-terracotta/75" />Revenue</span>
                  <span><span className="mr-1 inline-block size-2 bg-olive" />Known margin</span>
                </div>
              </div>
              {financeChartMonths.length === 0 ? (
                <p className="py-8 text-center text-sm text-ink/55">No completed orders yet.</p>
              ) : (
                <div className="mt-5 flex h-52 min-w-[680px] items-end gap-2 border-b border-ink/20 px-2">
                  {financeChartMonths.map((month) => {
                    const revenueHeight = Math.max(3, (month.revenue / financeChartMaximum) * 100);
                    const profitHeight = month.known_gross_profit > 0 ? Math.max(3, (month.known_gross_profit / financeChartMaximum) * 100) : 0;
                    return (
                      <div key={month.month_start} className="flex h-full min-w-12 flex-1 flex-col justify-end text-center">
                        <div className="mx-auto flex h-44 w-full max-w-12 items-end justify-center gap-1 bg-ink/5">
                          <div className="w-3 bg-terracotta/75" style={{ height: `${revenueHeight}%` }} title={`Revenue: ${formatVnd(month.revenue)}`} />
                          <div className="w-3 bg-olive" style={{ height: `${profitHeight}%` }} title={`Known margin: ${formatVnd(month.known_gross_profit)}`} />
                        </div>
                        <span className="mt-2 text-[10px] text-ink/55">{month.month_start.slice(2, 7)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-ink/20 text-xs uppercase tracking-wider text-ink/55">
                <tr>
                  <th className="px-2 py-3 font-medium">Month</th>
                  <th className="px-2 py-3 text-right font-medium">Revenue</th>
                  <th className="px-2 py-3 text-right font-medium">Discounts</th>
                  <th className="px-2 py-3 text-right font-medium">Known cost</th>
                  <th className="px-2 py-3 text-right font-medium">Known gross profit</th>
                  <th className="px-2 py-3 text-right font-medium">Cost pending</th>
                </tr>
              </thead>
              <tbody>
                {financeReport.map((month) => (
                  <tr key={month.month_start} className="border-b border-ink/10">
                    <td className="px-2 py-3">{month.month_start.slice(0, 7)}</td>
                    <td className="px-2 py-3 text-right">{formatVnd(month.revenue)}</td>
                    <td className="px-2 py-3 text-right">{formatVnd(month.discounts)}</td>
                    <td className="px-2 py-3 text-right">{formatVnd(month.known_cost)}</td>
                    <td className="px-2 py-3 text-right font-medium text-olive">{formatVnd(month.known_gross_profit)}</td>
                    <td className="px-2 py-3 text-right">{month.pending_cost_orders || '—'}</td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </>
        )}
      </section>}

      {activePage === 'payments' && <section className="border border-ink/20 bg-white p-5 shadow-sm">
        <div className="border-b border-ink/10 pb-4">
          <h2 className="text-lg font-medium uppercase tracking-wide">Payment reconciliation</h2>
          <p className="mt-1 text-sm text-ink/55">Track the account that actually received each completed payment.</p>
        </div>
        {paymentLoading ? (
          <p className="py-10 text-center text-sm text-ink/55 animate-pulse">Đang tải báo cáo thanh toán...</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[580px] text-left text-sm">
              <thead className="border-b border-ink/20 text-xs uppercase tracking-wider text-ink/55">
                <tr>
                  <th className="px-2 py-3 font-medium">Month</th>
                  <th className="px-2 py-3 font-medium">Received in</th>
                  <th className="px-2 py-3 text-right font-medium">Payments</th>
                  <th className="px-2 py-3 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {paymentReport.map((payment) => (
                  <tr key={`${payment.month_start}-${payment.payment_destination}`} className="border-b border-ink/10">
                    <td className="px-2 py-3">{payment.month_start.slice(0, 7)}</td>
                    <td className="px-2 py-3">{formatPaymentDestination(payment.payment_destination)}</td>
                    <td className="px-2 py-3 text-right">{payment.payment_count}</td>
                    <td className="px-2 py-3 text-right font-medium">{formatVnd(payment.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>}

      {activePage === 'orders' && <section className="border border-ink/20 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 border-b border-ink/10 pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-medium uppercase tracking-wide">Order history</h2>
            <p className="mt-1 text-sm text-ink/55">Review the exact transactions behind each monthly report.</p>
          </div>
          <label className="text-sm">
            Order month
            <select
              value={selectedOrderMonth}
              onChange={(event) => loadOrderHistory(event.target.value)}
              disabled={ordersLoading || !orderHistory}
              className="ml-3 border border-ink/20 bg-paper px-3 py-2 outline-none focus:border-sepia disabled:opacity-50"
            >
              {orderHistory?.months.map((month) => (
                <option key={month} value={month}>{month.slice(0, 7)}</option>
              ))}
            </select>
          </label>
        </div>
        {editingOrder && (
          <form onSubmit={saveOrderEdit} className="mt-5 border border-sepia/40 bg-paper p-4">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h3 className="font-medium uppercase tracking-wide">Edit order #{editingOrder.id}</h3>
                <p className="mt-1 text-xs text-ink/55">Saving re-applies this order’s FIFO stock allocation and records an audit log.</p>
              </div>
              <button type="button" onClick={() => setEditingOrder(null)} className="text-sm text-ink/55 underline">Cancel</button>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="text-sm">Customer name<input value={editingOrder.customerName} onChange={(event) => setEditingOrder({ ...editingOrder, customerName: event.target.value })} className="mt-1 w-full border border-ink/20 bg-white px-3 py-2" /></label>
              <label className="text-sm">Payment method<select value={editingOrder.paymentMethod} onChange={(event) => setEditingOrder({ ...editingOrder, paymentMethod: event.target.value })} className="mt-1 w-full border border-ink/20 bg-white px-3 py-2"><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option></select></label>
              {editingOrder.paymentMethod === 'bank_transfer' && <label className="text-sm">Destination account<select value={editingOrder.paymentDestination} onChange={(event) => setEditingOrder({ ...editingOrder, paymentDestination: event.target.value })} className="mt-1 w-full border border-ink/20 bg-white px-3 py-2"><option value="shop_account">Shop account</option><option value="personal_account">Personal account</option></select></label>}
              <label className="text-sm">Discount (VND)<input type="number" min="0" step="1" value={editingOrder.discount} onChange={(event) => setEditingOrder({ ...editingOrder, discount: event.target.value })} className="mt-1 w-full border border-ink/20 bg-white px-3 py-2" /></label>
              <label className="text-sm md:col-span-2">Reason for correction <span className="text-ink/40">(optional)</span><input value={editingOrder.changeNote} onChange={(event) => setEditingOrder({ ...editingOrder, changeNote: event.target.value })} className="mt-1 w-full border border-ink/20 bg-white px-3 py-2" /></label>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm"><thead className="text-xs uppercase tracking-wider text-ink/55"><tr><th className="pb-2">Product</th><th className="pb-2">Quantity</th><th className="pb-2">Unit price (VND)</th><th /></tr></thead><tbody>
                {editingOrder.items.map((item, index) => <tr key={`${item.productId}-${index}`}><td className="py-1"><select value={item.productId} onChange={(event) => { const product = products.find((candidate) => candidate.id === Number(event.target.value)); updateEditItem(index, { productId: Number(event.target.value), unitPrice: product?.price ?? item.unitPrice }); }} className="w-full border border-ink/20 bg-white px-2 py-2">{products.map((product) => <option key={product.id} value={product.id}>{product.name} ({product.exposures} exp)</option>)}</select></td><td className="py-1"><input type="number" min="1" step="1" value={item.quantity} onChange={(event) => updateEditItem(index, { quantity: event.target.value })} className="w-24 border border-ink/20 bg-white px-2 py-2" /></td><td className="py-1"><input type="number" min="0" step="1" value={item.unitPrice} onChange={(event) => updateEditItem(index, { unitPrice: event.target.value })} className="w-36 border border-ink/20 bg-white px-2 py-2" /></td><td className="py-1 text-right"><button type="button" disabled={editingOrder.items.length === 1} onClick={() => setEditingOrder({ ...editingOrder, items: editingOrder.items.filter((_, itemIndex) => itemIndex !== index) })} className="text-terracotta underline disabled:text-ink/30">Remove</button></td></tr>)}
              </tbody></table>
            </div>
            <button type="button" onClick={() => setEditingOrder({ ...editingOrder, items: [...editingOrder.items, { productId: products[0]?.id, quantity: 1, unitPrice: products[0]?.price || 0 }] })} disabled={!products.length} className="mt-3 text-sm text-sepia underline">+ Add product</button>
            <div className="mt-4 flex justify-end"><button type="submit" disabled={savingOrder} className="bg-ink px-4 py-3 text-sm uppercase tracking-wider text-paper disabled:bg-ink/30">{savingOrder ? 'Saving…' : 'Save changes'}</button></div>
          </form>
        )}
        {ordersLoading ? (
          <p className="py-10 text-center text-sm text-ink/55 animate-pulse">Đang tải lịch sử đơn hàng...</p>
        ) : orderHistory && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="border-b border-ink/20 text-xs uppercase tracking-wider text-ink/55">
                <tr>
                  <th className="px-2 py-3 font-medium">Date</th>
                  <th className="px-2 py-3 font-medium">Customer</th>
                  <th className="px-2 py-3 font-medium">Products</th>
                  <th className="px-2 py-3 text-right font-medium">Total</th>
                  <th className="px-2 py-3 text-right font-medium">Cost</th>
                  <th className="px-2 py-3 text-right font-medium">Profit</th>
                  <th className="px-2 py-3 font-medium">Received in</th>
                  <th className="px-2 py-3 font-medium"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {orderHistory.orders.map((order) => (
                  <tr key={order.id} className="border-b border-ink/10 align-top">
                    <td className="whitespace-nowrap px-2 py-3">{order.order_date.slice(0, 10)}{order.date_precision === 'month' ? '*' : ''}</td>
                    <td className="px-2 py-3">{order.customer_name || '—'}</td>
                    <td className="max-w-md px-2 py-3 text-ink/70">{order.products}</td>
                    <td className="whitespace-nowrap px-2 py-3 text-right">{formatVnd(order.total_amount)}</td>
                    <td className="whitespace-nowrap px-2 py-3 text-right">{order.total_cost === null ? 'Pending' : formatVnd(order.total_cost)}</td>
                    <td className="whitespace-nowrap px-2 py-3 text-right font-medium text-olive">{order.total_cost === null ? '—' : formatVnd(order.total_amount - order.total_cost)}</td>
                    <td className="whitespace-nowrap px-2 py-3">{formatPaymentDestination(order.payment_destination)}</td>
                    <td className="whitespace-nowrap px-2 py-3 text-right"><div className="flex justify-end gap-3"><button type="button" onClick={() => beginOrderEdit(order)} className="text-sepia underline underline-offset-4">Edit</button><button type="button" onClick={() => cancelOrder(order)} disabled={cancellingOrderId === order.id} className="text-terracotta underline underline-offset-4 disabled:text-ink/30">{cancellingOrderId === order.id ? 'Cancelling…' : 'Cancel'}</button><button type="button" onClick={() => deleteOrder(order)} disabled={deletingOrderId === order.id} className="text-ink/50 underline underline-offset-4 disabled:text-ink/30">{deletingOrderId === order.id ? 'Deleting…' : 'Delete'}</button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-ink/45">* Month-only date: the original workbook date was blank and was recorded as the first day of that month.</p>
          </div>
        )}
      </section>}
    </div>
  );
}

export default App;
