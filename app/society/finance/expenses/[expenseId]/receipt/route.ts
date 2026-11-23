import { getMe } from "@/lib/session";
import { SocietyAccessError } from "@/lib/society-access";
import { financeExpenseReceipt } from "@/lib/society-finance";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ expenseId: string }> }) {
  const headers = { "Cache-Control": "private, no-store" };
  const [{ expenseId }, me] = await Promise.all([params, getMe()]);
  try {
    const receipt = financeExpenseReceipt(me, expenseId);
    if (!receipt) return new Response(null, { status: 404, headers });
    const extension = receipt.contentType === "image/jpeg" ? "jpg" : "png";
    return new Response(new Uint8Array(receipt.bytes), {
      headers: {
        ...headers,
        "Content-Type": receipt.contentType,
        "Content-Disposition": `inline; filename="expense-receipt.${extension}"`,
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof SocietyAccessError) return new Response(null, { status: 404, headers });
    throw error;
  }
}
