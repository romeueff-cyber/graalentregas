import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';

interface InvoicePendingAlertProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNumber?: string;
}

/**
 * Alert displayed when trying to register a delivery for an order
 * that is not yet invoiced (ID_STATUS != 3) in the ERP.
 */
export function InvoicePendingAlert({ open, onOpenChange, orderNumber }: InvoicePendingAlertProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-status-waiting/20">
              <AlertTriangle className="w-6 h-6 text-status-waiting" />
            </div>
            <AlertDialogTitle>Pedido Pendente</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-2">
            {orderNumber && (
              <span className="block mb-2 font-mono text-foreground">
                Pedido #{orderNumber}
              </span>
            )}
            O pedido está pendente de faturamento no <strong>BeerSales</strong>.
            <br />
            <br />
            Realize o faturamento antes de registrar a entrega.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => onOpenChange(false)}>
            Entendi
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Helper function to check if an order is invoiced (faturado).
 * ERP ID_STATUS = 3 or 14 means the order is ready for delivery.
 * Returns true if order can proceed to delivery registration.
 */
export function isOrderInvoiced(erpStatus: string | null | undefined): boolean {
  if (!erpStatus) return false;
  const normalizedStatus = String(erpStatus).trim().toLowerCase();
  // Status 3 = Faturado, Status 19 = também válido para entrega
  return normalizedStatus === '3' || normalizedStatus === '19' || normalizedStatus === 'faturado';
}
