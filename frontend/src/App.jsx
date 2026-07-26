import { useEffect, useState } from 'react';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';

function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${apiBaseUrl}/api/products`)
      .then((res) => res.json())
      .then((data) => {
        setProducts(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching products:', err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen p-8 max-w-5xl mx-auto">
      <header className="mb-12 text-center border-b border-ink/10 pb-6">
        <h1 className="text-4xl font-light tracking-wide text-ink uppercase mb-2">Film Stock POS</h1>
        <p className="text-sm text-sepia/70 uppercase tracking-widest">Make It Grain</p>
      </header>

      {loading ? (
        <div className="text-center text-ink/60 animate-pulse">Đang tải danh sách phim...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.map((product) => (
            <div
              key={product.id}
              className="group border border-ink/20 p-6 rounded-sm bg-white shadow-sm hover:shadow-md hover:border-terracotta/50 transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-xl font-medium text-ink mb-1 group-hover:text-terracotta transition-colors">{product.name}</h2>
                    <span className="text-xs px-2 py-1 bg-paper border border-ink/10 text-sepia uppercase rounded-full">
                      {product.format}
                    </span>
                  </div>
                </div>
                <div className="text-2xl font-light text-ink mb-2">
                  {product.price.toLocaleString('vi-VN')}₫
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-ink/5 flex justify-between items-center">
                <span className={`text-sm ${product.stock > 5 ? 'text-olive' : 'text-terracotta'}`}>
                  Kho: {product.stock} cuộn
                </span>
                <button className="px-4 py-2 border border-ink bg-transparent text-ink text-sm uppercase tracking-wider hover:bg-ink hover:text-paper transition-all duration-300">
                  + Giỏ hàng
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
