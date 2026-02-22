import Link from 'next/link';

const Header = () => {
  return (
    <header className="bg-white shadow-md">
      <div className="container mx-auto px-6 py-4 flex justify-between items-center">
        <Link href="/" className="text-2xl font-bold text-gray-800">
          Fluer Ballet
        </Link>
        <nav>
          <ul className="flex space-x-6">
            <li><Link href="/" className="text-gray-600 hover:text-pink-500">Home</Link></li>
            <li><Link href="/classes" className="text-gray-600 hover:text-pink-500">Classes</Link></li>
            <li><Link href="/schedule" className="text-gray-600 hover:text-pink-500">Schedule</Link></li>
            <li><Link href="/instructors" className="text-gray-600 hover:text-pink-500">Instructors</Link></li>
            <li><Link href="/gallery" className="text-gray-600 hover:text-pink-500">Gallery</Link></li>
            <li><Link href="/contact" className="text-gray-600 hover:text-pink-500">Contact</Link></li>
          </ul>
        </nav>
      </div>
    </header>
  );
};

export default Header;
