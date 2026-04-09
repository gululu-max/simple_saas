import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { creem } from '@/lib/creem';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { productId, productType, userId, credits, returnPath } = body;

    // Verify authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // 支付成功后跳回来源页，默认跳首页
    const origin = request.headers.get('origin') || '';
    const successPath = returnPath || '/';
    const separator = successPath.includes('?') ? '&' : '?';
    const successUrl = `${origin}${successPath}${separator}payment=success`;

    // Create checkout session using SDK
    const checkout = await creem.checkouts.create({
      productId: productId,
      customer: {
        email: user.email,
      },
      successUrl,
      metadata: {
        user_id: user.id,
        product_type: productType,
        credits: credits || 0,
      },
    });

    return NextResponse.json({ checkoutUrl: checkout.checkoutUrl });
  } catch (error) {
    console.error('Checkout error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}