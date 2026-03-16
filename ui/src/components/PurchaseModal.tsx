import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn, formatCents } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Wallet,
  CreditCard,
  Shield,
  Zap,
  Clock,
  Check,
  AlertCircle,
  Tag,
} from "lucide-react";

export type PaymentMethod = "balance" | "card" | "alipay" | "wechat";

interface PurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  templateName: string;
  priceCents: number;
  originalPriceCents?: number;
  userBalanceCents: number;
  onConfirm: (paymentMethod: PaymentMethod) => void;
  isLoading?: boolean;
}

const PAYMENT_METHODS = [
  {
    id: "balance" as PaymentMethod,
    label: "templateDetail.accountBalance",
    icon: Wallet,
    description: "Use your account balance",
  },
  {
    id: "card" as PaymentMethod,
    label: "templateDetail.creditCard",
    icon: CreditCard,
    description: "Pay with credit or debit card via Stripe",
  },
  {
    id: "alipay" as PaymentMethod,
    label: "templateDetail.alipay",
    icon: () => (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M5.5 2C3.567 2 2 3.567 2 5.5S3.567 9 5.5 9 9 7.433 9 5.5 7.433 2 5.5 2zm0 2C6.327 4 7 4.673 7 5.5S6.327 7 5.5 7 4 6.327 4 5.5 4.673 4 5.5 4zM2 11v9h20v-9H2zm2 2h16v5H4v-5z"/>
      </svg>
    ),
    description: "Pay with Alipay",
  },
  {
    id: "wechat" as PaymentMethod,
    label: "templateDetail.wechatPay",
    icon: () => (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M8.5 2C4.91 2 2 4.462 2 7.5c0 1.69.89 3.188 2.27 4.162L3.5 13.5l3.09-1.545c.54.145 1.11.226 1.69.245-.08-.32-.13-.66-.13-1 0-2.76 2.69-5 6-5 .29 0 .58.02.86.06C14.57 4.02 11.81 2 8.5 2zm-1 4.5c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm4 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2.5 4c-2.76 0-5 1.79-5 4s2.24 4 5 4c.51 0 1-.07 1.48-.19L18 20l-.59-2.09C18.36 17.16 19 16.14 19 15c0-2.21-2.24-4-5-4zm-2.5 3c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm5 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1z"/>
      </svg>
    ),
    description: "Pay with WeChat Pay",
  },
];

export function PurchaseModal({
  isOpen,
  onClose,
  templateName,
  priceCents,
  originalPriceCents,
  userBalanceCents,
  onConfirm,
  isLoading = false,
}: PurchaseModalProps) {
  const { t } = useTranslation();
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>("balance");
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const hasDiscount = originalPriceCents && originalPriceCents > priceCents;
  const discountPercent = hasDiscount
    ? Math.round(((originalPriceCents! - priceCents) / originalPriceCents!) * 100)
    : 0;

  const isFree = priceCents === 0;
  const canUseBalance = userBalanceCents >= priceCents;

  const handleConfirm = () => {
    onConfirm(selectedPaymentMethod);
  };

  const isConfirmDisabled = isLoading || (!isFree && !agreedToTerms) || (selectedPaymentMethod === "balance" && !canUseBalance && !isFree);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            {isFree
              ? t("templateDetail.installTemplate", "Install Template")
              : t("templateDetail.purchaseTemplate", "Purchase Template")}
          </DialogTitle>
          <DialogDescription>
            {t("templateDetail.confirmInstallation", "Confirm installation of")}{" "}
            <span className="font-medium text-foreground">{templateName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Price Display */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {t("templateDetail.templatePrice", "Template Price")}
              </span>
              <div className="flex items-center gap-2">
                {hasDiscount && (
                  <span className="text-sm text-muted-foreground line-through">
                    {formatCents(originalPriceCents!)}
                  </span>
                )}
                <span className="text-lg font-semibold">
                  {isFree ? t("templateStore.free", "Free") : formatCents(priceCents)}
                </span>
              </div>
            </div>

            {hasDiscount && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-0 gap-1">
                  <Tag className="h-3 w-3" />
                  {discountPercent}% {t("common.off", "OFF")}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {t("templateDetail.limitedTime", "Limited time offer")}
                </span>
              </div>
            )}

            <Separator />

            <div className="flex items-center justify-between">
              <span className="font-medium">{t("templateDetail.total", "Total")}</span>
              <span className="text-xl font-bold">
                {isFree ? t("templateStore.free", "Free") : formatCents(priceCents)}
              </span>
            </div>
          </div>

          {/* Payment Method Selection */}
          {!isFree && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">
                {t("templateDetail.paymentMethod", "Payment Method")}
              </Label>
              <TooltipProvider>
                <div className="space-y-2">
                  {PAYMENT_METHODS.map((method) => {
                    const isBalanceMethod = method.id === "balance";
                    const isInsufficientBalance = isBalanceMethod && !canUseBalance;
                    const Icon = method.icon;

                    return (
                      <Tooltip key={method.id}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => !isInsufficientBalance && setSelectedPaymentMethod(method.id)}
                            disabled={isInsufficientBalance}
                            className={cn(
                              "w-full flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all",
                              selectedPaymentMethod === method.id
                                ? "border-primary bg-primary/5"
                                : "border-transparent bg-muted hover:bg-muted/80",
                              isInsufficientBalance && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            <div className="shrink-0">
                              <Icon className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm">
                                {t(method.label)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {isBalanceMethod
                                  ? `${t("templateDetail.balanceAvailable", "Balance available")}: ${formatCents(userBalanceCents)}`
                                  : t(method.description)}
                              </div>
                            </div>
                            {selectedPaymentMethod === method.id && (
                              <div className="shrink-0 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                                <Check className="h-3 w-3 text-primary-foreground" />
                              </div>
                            )}
                          </button>
                        </TooltipTrigger>
                        {isInsufficientBalance && (
                          <TooltipContent>
                            <p>{t("templateDetail.insufficientBalance", "Insufficient balance")}</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    );
                  })}
                </div>
              </TooltipProvider>
            </div>
          )}

          {/* Trust Badges */}
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Shield className="h-3.5 w-3.5" />
              <span>{t("templateDetail.securePayment", "Secure payment")}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              <span>{t("templateDetail.instantDelivery", "Instant delivery")}</span>
            </div>
          </div>

          {/* Terms Agreement */}
          {!isFree && (
            <div className="flex items-start gap-3">
              <Checkbox
                id="terms"
                checked={agreedToTerms}
                onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
                className="mt-0.5"
              />
              <Label htmlFor="terms" className="text-xs text-muted-foreground font-normal cursor-pointer">
                {t("templateDetail.agreeTerms", "I agree to the")}{" "}
                <a href="#" className="text-primary hover:underline">
                  {t("templateDetail.termsOfService", "Terms of Service")}
                </a>{" "}
                {t("common.and", "and")}{" "}
                <a href="#" className="text-primary hover:underline">
                  {t("templateDetail.refundPolicy", "Refund Policy")}
                </a>
              </Label>
            </div>
          )}

          {/* Balance Warning */}
          {selectedPaymentMethod === "balance" && !canUseBalance && !isFree && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                {t("templateDetail.insufficientBalanceMessage", "Your account balance is insufficient. Please select another payment method or add funds to your account.")}
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
            className={cn(isFree && "bg-emerald-600 hover:bg-emerald-700")}
          >
            {isLoading ? (
              <>
                <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                {isFree
                  ? t("templateStore.installing", "Installing...")
                  : t("templateStore.purchasing", "Purchasing...")}
              </>
            ) : isFree ? (
              <>
                <Zap className="h-4 w-4 mr-2" />
                {t("templateStore.install", "Install Now")}
              </>
            ) : (
              <>
                <Wallet className="h-4 w-4 mr-2" />
                {t("templateDetail.purchaseTemplate", "Purchase")}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
