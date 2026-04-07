import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const actionType = formData.get("action");

  if (actionType === "test") {
    const sku = formData.get("sku") as string;
    // Mock SKU lookup: assume base amount is 100 for any SKU
    const base = 100;
    const tax = base * 0.2;
    const courier = 5;
    const total = base + tax + courier;
    return { base, tax, courier, total, sku };
  }

  return null;
};

export default function Index() {
  const fetcher = useFetcher<typeof action>();
  const result = fetcher.data;

  return (
    <s-page heading="SKU Lookup + Tax + Courier Charge">
      <s-section heading="Settings">
        <form method="post">
          <label>
            Supabase URL:
            <input type="text" name="supabaseUrl" />
          </label>
          <br />
          <label>
            Supabase Service Role:
            <input type="password" name="serviceRole" />
          </label>
          <br />
          <label>
            SKU Table Name:
            <input type="text" name="tableName" />
          </label>
          <br />
          <button type="submit" name="action" value="save">Save Settings</button>
        </form>
      </s-section>

      <s-section heading="Test SKU Lookup">
        <form method="post">
          <label>
            Enter SKU:
            <input type="text" name="sku" required />
          </label>
          <br />
          <button type="submit" name="action" value="test">Test SKU</button>
        </form>

        {result && (
          <div style={{ border: '1px solid #ccc', padding: '10px', marginTop: '10px' }}>
            <p>SKU: {result.sku}</p>
            <p>Base Amount: £{result.base}</p>
            <p>Tax (20%): £{result.tax}</p>
            <p>Courier Charge: £{result.courier}</p>
            <p>Total: £{result.total}</p>
          </div>
        )}
      </s-section>
    </s-page>
  );
}
