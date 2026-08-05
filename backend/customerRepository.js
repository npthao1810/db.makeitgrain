const database = require('./database');

async function listCustomerProfiles() {
  const { rows } = await database.query(
    `select customer_name, customer_contact, customer_link, delivery_phone, delivery_address
     from public.orders
     where customer_name is not null or customer_contact is not null or customer_link is not null
     order by order_date desc nulls last, id desc`,
  );

  // A newer order is more likely to contain current details. Merge the newest
  // available name, link, phone, and address into one reusable profile.
  const profilesByCustomer = new Map();
  for (const row of rows) {
    const key = (row.customer_link || row.customer_name || row.customer_contact || '').trim().toLocaleLowerCase();
    if (!key) continue;
    const profile = profilesByCustomer.get(key) || {
      customerName: null,
      customerContact: null,
      customerLink: null,
      phoneNumber: null,
      address: null,
    };
    if (!profile.customerName && row.customer_name) profile.customerName = row.customer_name;
    if (!profile.customerContact && row.customer_contact) profile.customerContact = row.customer_contact;
    if (!profile.customerLink && row.customer_link) profile.customerLink = row.customer_link;
    if (!profile.phoneNumber && (row.delivery_phone || row.customer_contact)) {
      profile.phoneNumber = row.delivery_phone || row.customer_contact;
    }
    if (!profile.address && row.delivery_address) profile.address = row.delivery_address;
    profilesByCustomer.set(key, profile);
  }
  return [...profilesByCustomer.values()];
}

module.exports = { listCustomerProfiles };
