import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, BookOpen, Upload, MessageSquare, Check, LogOut } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useEffect } from "react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/ui/UserAvatar";

const features = [
  {
    icon: <Upload className="h-6 w-6 text-sattva-600" />,
    title: "Upload Any Content",
    description: "Upload your videos, audios, PDFs, and documents to create your personal knowledge base."
  },
  {
    icon: <BookOpen className="h-6 w-6 text-sattva-600" />,
    title: "Organize Knowledge",
    description: "All your content is automatically processed, indexed, and organized for easy retrieval."
  },
  {
    icon: <MessageSquare className="h-6 w-6 text-sattva-600" />,
    title: "Chat with Your Content",
    description: "Ask questions and get AI-powered responses sourced directly from your documents."
  }
];

const pricingPlans = [
  {
    name: "Free",
    price: "$0",
    description: "Perfect for getting started",
    features: [
      "5 uploads per month",
      "Basic AI chat",
      "Text extraction",
      "7-day data retention"
    ],
    cta: "Sign Up Free",
    highlighted: false
  },
  {
    name: "Pro",
    price: "$19",
    period: "/month",
    description: "For individuals who need more",
    features: [
      "Unlimited uploads",
      "Advanced AI responses",
      "YouTube video processing",
      "30-day data retention",
      "Priority support"
    ],
    cta: "Get Started",
    highlighted: true
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "For teams and organizations",
    features: [
      "Everything in Pro",
      "Team collaboration",
      "Custom integrations",
      "Unlimited data retention",
      "Dedicated support"
    ],
    cta: "Contact Sales",
    highlighted: false
  }
];

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  
  // Remove the redirect to dashboard
  // If still loading, show minimal content
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sattva-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold mb-2">Loading...</h2>
          <p className="text-gray-500">Please wait while we verify your session.</p>
        </div>
      </div>
    );
  }

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Logged out successfully");
    } catch (error) {
      console.error("Error signing out:", error);
      toast.error("Failed to log out");
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Navigation */}
      <nav className="w-full py-4 px-6 border-b">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-gradient-to-r from-sattva-600 to-sattva-800 flex items-center justify-center">
              <span className="text-white font-semibold text-md">S</span>
            </div>
            <span className="font-bold text-xl">Sattva AI</span>
          </div>
          
          <div className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-sm font-medium hover:text-sattva-600 transition-colors">Features</a>
            <a href="#pricing" className="text-sm font-medium hover:text-sattva-600 transition-colors">Pricing</a>
            <a href="#" className="text-sm font-medium hover:text-sattva-600 transition-colors">Blog</a>
          </div>
          
          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <Link to="/dashboard">
                  <Button variant="ghost" className="font-medium">Dashboard</Button>
                </Link>
                <Link to="/chat">
                  <Button className="bg-sattva-600 hover:bg-sattva-700 text-white">Chat</Button>
                </Link>
                <Button 
                  variant="ghost" 
                  className="font-medium flex items-center gap-1" 
                  onClick={handleSignOut}
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </Button>
                <UserAvatar />
              </>
            ) : (
              <>
                <Link to="/auth?mode=login">
                  <Button variant="ghost" className="font-medium">Log In</Button>
                </Link>
                <Link to="/auth?mode=signup">
                  <Button className="bg-sattva-600 hover:bg-sattva-700 text-white">Sign Up</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto text-center max-w-4xl">
          <div className="inline-block px-3 py-1 bg-sattva-100 text-sattva-800 rounded-full text-sm font-medium mb-8 animate-fade-in">
            Introducing Sattva AI
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight leading-tight animate-slide-in-bottom" style={{ animationDelay: '0.1s' }}>
            <span className="text-gradient">Your Personal Knowledge Base</span> Powered by AI
          </h1>
          
          <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto animate-slide-in-bottom" style={{ animationDelay: '0.2s' }}>
            Upload your content, extract knowledge, and chat with an AI that understands your documents, videos, and more.
          </p>
          
          <div className="flex flex-col sm:flex-row justify-center gap-4 animate-slide-in-bottom" style={{ animationDelay: '0.3s' }}>
            {user ? (
              <Link to="/dashboard">
                <Button className="bg-sattva-600 hover:bg-sattva-700 text-white px-8 py-6 text-lg">
                  Go To Dashboard
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            ) : (
              <Link to="/auth?mode=signup">
                <Button className="bg-sattva-600 hover:bg-sattva-700 text-white px-8 py-6 text-lg">
                  Get Started
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            )}
            <a href="#features">
              <Button variant="outline" className="px-8 py-6 text-lg">
                See how it works
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6 bg-gray-50">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How Sattva AI Works</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Transform your content into searchable knowledge and get AI-powered insights.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                <div className="h-12 w-12 bg-sattva-100 rounded-lg flex items-center justify-center mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Choose the plan that fits your needs
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {pricingPlans.map((plan, index) => (
              <div 
                key={index} 
                className={`rounded-xl overflow-hidden transition-all ${
                  plan.highlighted 
                    ? 'border-2 border-sattva-500 ring-4 ring-sattva-100/50 shadow-lg transform hover:-translate-y-1' 
                    : 'border border-gray-200 shadow-sm hover:shadow-md'
                }`}
              >
                <div className={`p-6 ${plan.highlighted ? 'bg-gradient-to-r from-sattva-600 to-sattva-700 text-white' : 'bg-white'}`}>
                  <h3 className="text-xl font-semibold mb-1">{plan.name}</h3>
                  <div className="flex items-end gap-1 mb-3">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    {plan.period && <span className="text-sm opacity-80">{plan.period}</span>}
                  </div>
                  <p className={`text-sm ${plan.highlighted ? 'text-white/80' : 'text-gray-600'}`}>
                    {plan.description}
                  </p>
                </div>
                
                <div className="p-6 bg-white">
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start">
                        <Check className="h-5 w-5 text-sattva-600 mr-2 flex-shrink-0" />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <Button 
                    className={`w-full ${
                      plan.highlighted 
                        ? 'bg-sattva-600 hover:bg-sattva-700 text-white' 
                        : 'bg-white text-gray-800 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {plan.cta}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12 px-6 mt-auto">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-full bg-gradient-to-r from-sattva-500 to-sattva-700 flex items-center justify-center">
                  <span className="text-white font-semibold text-md">S</span>
                </div>
                <span className="font-bold text-xl text-white">Sattva AI</span>
              </div>
              <p className="text-gray-400">
                Your personal AI-powered knowledge base.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold text-white mb-4">Product</h4>
              <ul className="space-y-2">
                <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Testimonials</a></li>
                <li><a href="#" className="hover:text-white transition-colors">FAQ</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-white mb-4">Company</h4>
              <ul className="space-y-2">
                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-white mb-4">Legal</h4>
              <ul className="space-y-2">
                <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Security</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-10 pt-6 flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm">© 2023 Sattva AI. All rights reserved.</p>
            <div className="flex space-x-4 mt-4 md:mt-0">
              <a href="#" className="hover:text-white transition-colors">Twitter</a>
              <a href="#" className="hover:text-white transition-colors">LinkedIn</a>
              <a href="#" className="hover:text-white transition-colors">GitHub</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
