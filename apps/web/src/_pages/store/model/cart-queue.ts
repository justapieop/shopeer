/** Serialize additions so an older response cannot overwrite newer cart totals. */
export function createCartQueue<T>(addItem: (productId: string, quantity: number) => Promise<T>) {
  let queue: Promise<void> = Promise.resolve();
  return (productId: string, quantity: number): Promise<T> => {
    if (!productId.trim() || !Number.isSafeInteger(quantity) || quantity < 1) {
      return Promise.reject(new Error("Choose a valid whole-number quantity."));
    }
    const result = queue.then(() => addItem(productId, quantity));
    queue = result.then(() => undefined, () => undefined);
    return result;
  };
}
