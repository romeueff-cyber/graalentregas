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
 * ERP ID_STATUS = 3 means "Faturado" (invoiced).
 * Returns true if order can proceed to delivery registration.
 */
export function isOrderInvoiced(erpStatus: string | null | undefined): boolean {
  if (!erpStatus) return false;
  // The status can be the ID "3" or contain "3" as status code
  // Also handle cases where status description is passed
  const normalizedStatus = String(erpStatus).trim();
  return normalizedStatus === '3' || normalizedStatus.toLowerCase() === 'faturado';
}
