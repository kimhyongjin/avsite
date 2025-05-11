export default function Footer() {
    return (
      <footer className="bg-white border-t py-4 mt-8">
        <div className="max-w-6xl mx-auto text-center text-sm text-gray-600">
          © {new Date().getFullYear()} AV 콘텐츠. All rights reserved.
        </div>
      </footer>
    );
  }
  