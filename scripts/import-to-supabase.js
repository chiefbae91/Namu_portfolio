const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const { randomUUID } = require('crypto');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function importData() {
  try {
    // trading_hints 임포트만
    const tradingHints = JSON.parse(fs.readFileSync('trading_hints.json', 'utf8'));
    const tradingHintsWithUUID = tradingHints.map(hint => {
      let price = null;
      if (hint.price) {
        const priceStr = hint.price.toString().trim();
        const prices = priceStr.split(/\s+/);
        price = parseFloat(prices[0]);
      }

      return {
        id: randomUUID(),
        ticker: hint.ticker,
        created_by: '00000000-0000-0000-0000-000000000000',
        hint_date: hint.hint_date,
        type: hint.type,
        price: price,
        current_price: hint.current_price ? parseFloat(hint.current_price) : null,
        note: hint.note || null,
        is_public: true,
        can_edit_users: [],
        created_at: new Date(hint.created_at)
      };
    });
    const { error: hintsError } = await supabase
      .from('trading_hints')
      .insert(tradingHintsWithUUID);
    if (hintsError) throw hintsError;
    console.log('✅ trading_hints imported');

    console.log('\n🎉 All data imported successfully!');
  } catch (error) {
    console.error('❌ Import failed:', error);
  }
}

importData();