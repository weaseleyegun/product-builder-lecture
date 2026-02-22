export default function Home() {
  return (
    <>
      {/* Hero Section */}
      <section 
        className="relative bg-pink-50 text-white text-center py-40"
        // TODO: Replace bg-pink-50 with a background image, e.g., style={{ backgroundImage: "url('/path/to/your/image.jpg')" }}
      >
        <div className="absolute inset-0 bg-black opacity-30"></div>
        <div className="relative z-10">
          <h1 className="text-5xl font-bold mb-4">Graceful Movements, Lasting Memories</h1>
          <p className="text-xl mb-8">Experience the art of ballet at Fluer Academy.</p>
          <a 
            href="/classes" 
            className="bg-white text-pink-700 font-semibold py-3 px-8 rounded-full hover:bg-pink-100 transition duration-300"
          >
            Explore Classes
          </a>
        </div>
      </section>

      {/* Other sections can go here */}
    </>
  );
}
