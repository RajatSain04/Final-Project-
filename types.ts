export interface Product {
  id: number;
  name: string;
  price: number;
  originalPrice?: number;
  imageUrl: string;
  category: string;
  isFlashSale: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface NotificationPreferences {
  flashSales: boolean;
  newArrivals: boolean;
  priceDrops: boolean;
  backInStock: boolean;
}

export type NotificationCategory = keyof NotificationPreferences;
