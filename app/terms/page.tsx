"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Scale, AlertTriangle, FileText, Gavel, CreditCard, Mail, CheckCircle, XCircle } from "lucide-react";

export default function TermsPage() {
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
              <h1 className="text-xl font-bold">Terms of Service</h1>
              <p className="text-sm text-muted-foreground">
                The rules and guidelines for using Matchfix
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
              <Scale className="mr-2 h-4 w-4" />
              Legal Terms
            </div>
            <h2 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Terms of Service
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              These terms govern your use of Matchfix, an AI-powered dating profile analysis service. 
              By using our service, you agree to these terms and conditions.
            </p>
            <p className="text-sm text-muted-foreground">
              <strong>Effective Date:</strong> March 6, 2026
            </p>
          </motion.div>

          {/* Key Points */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="grid gap-6 md:grid-cols-3"
          >
            <Card className="border-2">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center mb-4">
                  <AlertTriangle className="h-6 w-6 text-amber-600" />
                </div>
                <CardTitle className="text-lg">For Entertainment</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  Our AI analysis and "roasts" are for entertainment purposes only, not professional dating or psychological advice.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center mb-4">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle className="text-lg">Your Content</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  You are solely responsible for the screenshots you upload. Do not upload content that violates third-party privacy.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center mb-4">
                  <Gavel className="h-6 w-6 text-red-600" />
                </div>
                <CardTitle className="text-lg">No Liability</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  We are not responsible for your dating outcomes, rejected matches, or any emotional distress caused by the AI.
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Service Description & AI Nature */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="space-y-8"
          >
            <div className="bg-muted/30 rounded-2xl p-8">
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 text-primary" />
                AI Nature & Entertainment Disclaimer
              </h3>
              
              <div className="space-y-4 text-muted-foreground">
                <p>
                  Matchfix uses generative Artificial Intelligence (AI) to analyze dating profiles and provide "roasts", red-flag detection, and comedic insights. By using the Service, you acknowledge that:
                </p>
                
                <ul className="space-y-2">
                  <li>• <strong>AI is unpredictable:</strong> The generated reports may contain errors, inaccuracies, or subjective opinions that do not reflect reality.</li>
                  <li>• <strong>Edgy Content:</strong> The AI is programmed to be witty, brutally honest, and sometimes highly critical. If you are easily offended, this service may not be for you.</li>
                  <li>• <strong>No Professional Advice:</strong> The insights provided are strictly for entertainment purposes and should not be used as a substitute for professional relationship counseling.</li>
                </ul>
              </div>
            </div>
          </motion.div>

          {/* User Responsibilities */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="space-y-8"
          >
            <div className="bg-muted/30 rounded-2xl p-8">
              <h3 className="text-2xl font-bold mb-6">Your Responsibilities</h3>
              
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h4 className="font-semibold mb-3 text-green-700 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" /> Acceptable Use
                  </h4>
                  <ul className="space-y-2 text-muted-foreground">
                    <li>• Ensure you have the right to upload the screenshots/text</li>
                    <li>• Use the service for personal entertainment</li>
                    <li>• Keep your account credentials secure</li>
                    <li>• Report any technical issues to our support team</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-3 text-red-700 flex items-center gap-2">
                    <XCircle className="h-4 w-4" /> Prohibited Activities
                  </h4>
                  <ul className="space-y-2 text-muted-foreground">
                    <li>• Uploading highly sensitive, illegal, or non-consensual explicit content</li>
                    <li>• Using the service to harass, dox, bully, or stalk individuals</li>
                    <li>• Attempting to reverse-engineer our AI prompts</li>
                    <li>• Using automated tools to bulk-generate requests</li>
                  </ul>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Limitation of Liability */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            className="space-y-8"
          >
            <div className="bg-muted/30 rounded-2xl p-8">
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
                <Gavel className="h-6 w-6 text-primary" />
                Limitation of Liability
              </h3>
              
              <div className="space-y-4 text-muted-foreground">
                <p>
                  To the maximum extent permitted by law, Matchfix and its creators shall not be liable for any indirect, incidental, special, consequential, or punitive damages, resulting from:
                </p>
                <ul className="space-y-2">
                  <li>• Your access to or use of or inability to access or use the Service.</li>
                  <li>• Any conduct or content of any third party on the Service.</li>
                  <li>• Any relationship decisions, dating outcomes, or emotional distress resulting from our AI-generated reports.</li>
                </ul>
              </div>
            </div>
          </motion.div>

          {/* Payment Terms */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 1.0 }}
            className="space-y-8"
          >
            <div className="bg-muted/30 rounded-2xl p-8">
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
                <CreditCard className="h-6 w-6 text-primary" />
                Payment and Refund Terms
              </h3>
              
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h4 className="font-semibold mb-3">Purchasing Credits</h4>
                  <ul className="space-y-2 text-muted-foreground">
                    <li>• Services are accessed via purchasing digital credits/packages</li>
                    <li>• Payments are securely processed by Creem.io</li>
                    <li>• We do not store your credit card information</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-3">Refund Policy</h4>
                  <ul className="space-y-2 text-muted-foreground">
                    <li>• Due to the digital AI nature, all purchases are <strong>final and non-refundable</strong></li>
                    <li>• Disagreeing with the AI's opinion is not grounds for a refund</li>
                    <li>• If a technical error prevents generation, contact support for credit restoration</li>
                  </ul>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Changes to Terms */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 1.2 }}
            className="space-y-8"
          >
            <div className="bg-muted/30 rounded-2xl p-8">
              <h3 className="text-2xl font-bold mb-6">Changes to These Terms</h3>
              
              <div className="space-y-4 text-muted-foreground">
                <p>
                  We may update these Terms of Service from time to time to reflect changes in our service, 
                  legal requirements, or business practices. When we make changes:
                </p>
                
                <ul className="space-y-2">
                  <li>• We will update the "Effective Date" at the top of this page</li>
                  <li>• Continued use of our service after changes constitutes acceptance of new terms</li>
                  <li>• You can always find the current version of our terms on this page</li>
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
            <h3 className="text-2xl font-bold mb-4">Questions About These Terms?</h3>
            <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
              If you have any questions about these Terms of Service or need clarification about your rights and responsibilities, 
              please contact us. We're here to help ensure you understand and can comply with these terms.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild className="gap-2">
                <a href="mailto:gululumax01@gmail.com">
                  <Mail className="h-4 w-4" />
                  gululumax01@gmail.com
                </a>
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}