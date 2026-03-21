"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Shield, Eye, Database, Lock, UserCheck, Globe, Mail } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container px-4 md:px-6 py-4">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="sm" className="gap-2">
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
                Back to Home
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-bold">Privacy Policy</h1>
              <p className="text-sm text-muted-foreground">
                How we protect and handle your data
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container px-4 md:px-6 py-16">
        <div className="max-w-4xl mx-auto space-y-12">
          {/* Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center space-y-6"
          >
            <div className="inline-flex items-center rounded-full px-3 py-1 text-sm bg-primary/10 text-primary mb-4">
              <Shield className="mr-2 h-4 w-4" />
              Your Privacy Matters
            </div>
            <h2 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Privacy Policy for Matchfix
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              We are committed to protecting your privacy and being transparent about how we collect, 
              use, and protect your personal information when you use our AI-powered dating profile analysis service.
            </p>
            <p className="text-sm text-muted-foreground">
              <strong>Effective Date:</strong> March 6, 2026
            </p>
          </motion.div>

          {/* Privacy Principles */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="grid gap-6 md:grid-cols-3"
          >
            <Card className="border-2">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Eye className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Transparency</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  We clearly explain what data we collect and how we use it to provide you with the most accurate and insightful profile analysis.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Lock className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Security</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  Your uploaded screenshots and profile texts are processed securely and are never publicly displayed or sold to third parties.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <UserCheck className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Control</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  You have full control over your account. You can request to delete your account, generated reports, and payment history at any time.
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Information We Collect */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="space-y-8"
          >
            <div className="bg-muted/30 rounded-2xl p-8">
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
                <Database className="h-6 w-6 text-primary" />
                Information We Collect
              </h3>
              
              <div className="space-y-6">
                <div>
                  <h4 className="font-semibold mb-3">Information You Provide</h4>
                  <ul className="space-y-2 text-muted-foreground">
                    <li>• <strong>Account Information:</strong> Your email address when you sign in via our secure provider.</li>
                    <li>• <strong>Uploaded Content:</strong> Screenshots, photos, or text from dating profiles you submit for AI analysis.</li>
                    <li>• <strong>Payment Information:</strong> Handled entirely by our secure third-party processor (Creem.io). We do not store your credit card details.</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-3">Information We Collect Automatically</h4>
                  <ul className="space-y-2 text-muted-foreground">
                    <li>• <strong>Usage Data:</strong> How you interact with our website to help us improve the user experience.</li>
                    <li>• <strong>Device Information:</strong> Basic browser type and operating system analytics.</li>
                  </ul>
                </div>
              </div>
            </div>
          </motion.div>

          {/* How We Use Information */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="space-y-8"
          >
            <div className="bg-muted/30 rounded-2xl p-8">
              <h3 className="text-2xl font-bold mb-6">How We Use Your Information</h3>
              
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h4 className="font-semibold mb-3">Service Provision</h4>
                  <ul className="space-y-2 text-muted-foreground">
                    <li>• Generate AI-powered dating profile analysis and "boosts".</li>
                    <li>• Manage your account and track your available analysis credits.</li>
                    <li>• Process your payments and subscriptions securely.</li>
                    <li>• Send essential service updates and payment receipts.</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-3">Service Improvement</h4>
                  <ul className="space-y-2 text-muted-foreground">
                    <li>• Analyze platform usage to optimize our AI prompts.</li>
                    <li>• Develop new features and capabilities for Matchfix.</li>
                    <li>• Ensure service security and prevent fraudulent transactions.</li>
                  </ul>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Data Sharing */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            className="space-y-8"
          >
            <div className="bg-muted/30 rounded-2xl p-8">
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
                <Globe className="h-6 w-6 text-primary" />
                Information Sharing
              </h3>
              
              <div className="space-y-4 text-muted-foreground">
                <p>
                  <strong>We do not sell your personal information.</strong> We share your data only with trusted infrastructure partners to keep the service running:
                </p>
                
                <ul className="space-y-2">
                  <li>• <strong>AI Providers:</strong> To process the text/images and generate the analysis reports.</li>
                  <li>• <strong>Supabase:</strong> For secure database hosting and user authentication.</li>
                  <li>• <strong>Creem.io:</strong> To securely process payments and manage premium credits.</li>
                  <li>• <strong>Vercel:</strong> For hosting our website infrastructure.</li>
                </ul>
              </div>
            </div>
          </motion.div>

          {/* Contact Information */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 1.4 }}
            className="text-center bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 rounded-2xl p-8"
          >
            <h3 className="text-2xl font-bold mb-4">Questions About Privacy?</h3>
            <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
              If you have any questions about this Privacy Policy, our data practices, or if you'd like to request account deletion, please don't hesitate to contact us.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild className="gap-2">
                <a href="mailto:gululumax01@gmail.com">
                  <Mail className="h-4 w-4" />
                  gululumax01@gmail.com
                </a>
              </Button>
              <Button asChild variant="outline">
                <Link href="/">
                  Back to Home
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}