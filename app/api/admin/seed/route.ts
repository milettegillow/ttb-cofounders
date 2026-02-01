import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/src/lib/supabaseAdmin'

async function verifyAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authorized: false, user: null }
  }

  const token = authHeader.substring(7)
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)

  if (error || !user?.email) {
    return { authorized: false, user: null }
  }

  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()) || []
  if (!adminEmails.includes(user.email)) {
    return { authorized: false, user: null }
  }

  return { authorized: true, user }
}

// Generate rich profile data for a given index
function generateProfileData(index: number) {
  const firstNames = ['Alex', 'Sarah', 'James', 'Emma', 'Michael', 'Priya', 'David', 'Lisa', 'Ryan', 'Maya', 'Jordan', 'Taylor', 'Casey', 'Morgan', 'Riley', 'Avery', 'Quinn', 'Sage', 'River', 'Skyler']
  const lastNames = ['Chen', 'Martinez', 'Park', 'Thompson', 'Rodriguez', 'Sharma', 'Kim', 'Anderson', 'O\'Connor', 'Patel', 'Williams', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor', 'Jackson', 'White', 'Harris']
  
  const roles = ['Technical cofounder', 'Business cofounder']
  const locations = [
    'San Francisco, PT', 'New York, ET', 'Seattle, PT', 'London, GMT', 'Austin, CT',
    'Bangalore, IST', 'Toronto, ET', 'Berlin, CET', 'Dublin, GMT', 'Los Angeles, PT',
    'Chicago, CT', 'Boston, ET', 'Vancouver, PT', 'Amsterdam, CET', 'Sydney, AEDT',
    'Singapore, SGT', 'Tokyo, JST', 'Paris, CET', 'Barcelona, CET', 'Stockholm, CET'
  ]
  
  const domains = [
    'AI/ML, Healthcare Tech', 'FinTech, Consumer Products', 'Cloud Infrastructure, DevOps',
    'EdTech, Consumer Apps', 'Blockchain, DeFi', 'E-commerce, Marketplaces',
    'Mobile Apps, Consumer Tech', 'Climate Tech, Sustainability', 'Cybersecurity, Enterprise SaaS',
    'Creator Economy, Social Media', 'Real Estate Tech', 'Food Tech', 'Travel Tech',
    'Fitness Tech', 'Music Tech', 'Gaming', 'VR/AR', 'IoT, Smart Cities', 'Biotech', 'Robotics'
  ]
  
  const techSkills = [
    'Python, TensorFlow, React, Node.js', 'Product Strategy, Go-to-Market, Sales',
    'AWS, Kubernetes, Go, Terraform', 'Marketing, Growth, Community Building',
    'Solidity, Rust, Web3, Smart Contracts', 'Operations, Supply Chain, Business Development',
    'iOS, Swift, React Native, Firebase', 'Strategy, Partnerships, Impact Measurement',
    'Security, Penetration Testing, Go, Python', 'Content Strategy, Creator Relations, Brand Partnerships',
    'TypeScript, Next.js, PostgreSQL', 'Java, Spring Boot, Microservices',
    'C++, Embedded Systems, IoT', 'Data Science, SQL, Tableau', 'DevOps, CI/CD, Docker',
    'UI/UX Design, Figma, Prototyping', 'Sales, Business Development, Partnerships',
    'Product Management, Roadmapping', 'Customer Success, Support', 'Finance, Accounting, Fundraising'
  ]
  
  const availabilities = [
    'Working full-time on my startup',
    'Currently in a job that I have to quit',
    'I\'m a student with <1y left',
    'I\'m a student with <2y left'
  ]
  
  const firstName = firstNames[index % firstNames.length]
  const lastName = lastNames[Math.floor(index / firstNames.length) % lastNames.length]
  const role = roles[index % roles.length]
  const location = locations[index % locations.length]
  const domain = domains[index % domains.length]
  const tech = techSkills[index % techSkills.length]
  const availability = availabilities[index % availabilities.length]
  
  const skillsBackgrounds = [
    `${10 + (index % 5)} years building ML products at Google and startups. Expert in computer vision and NLP. Built ${3 + (index % 3)} successful SaaS products from scratch.`,
    `Former VP of Product at Stripe. Led product launches that generated $${50 + (index * 5)}M+ ARR. Expert in B2B SaaS and payment infrastructure.`,
    `Senior Infrastructure Engineer at Amazon. Built systems handling millions of requests per second. Expert in distributed systems and cloud architecture.`,
    `Grew a language learning app from 0 to ${5 + (index % 3)}M users. Expert in viral growth loops and community-driven products. Previously at Duolingo.`,
    `Built multiple DeFi protocols on Ethereum. Expert in smart contract security and tokenomics. Previously at Compound Finance.`,
    `Built and scaled a marketplace from 0 to $${10 + (index % 5)}M GMV. Expert in two-sided marketplace dynamics and operations. Previously at Flipkart.`,
    `Shipped ${5 + (index % 3)} apps with 1M+ downloads each. Expert in mobile UX and performance optimization. Previously at Instagram and TikTok.`,
    `Led sustainability initiatives at Tesla and Rivian. Expert in carbon accounting and climate tech business models. MBA from Stanford.`,
    `Security engineer at Palantir and CrowdStrike. Expert in threat detection and security automation. Built security tools used by Fortune 500 companies.`,
    `Built creator programs at YouTube and Twitch. Expert in creator monetization and community building. Grew creator revenue by ${300 + (index * 10)}% at previous company.`
  ]
  
  const interestsBuilding = [
    `Building an AI-powered healthcare platform that helps doctors diagnose rare diseases faster. Looking for a ${role === 'Technical cofounder' ? 'business' : 'technical'} cofounder with healthcare industry connections.`,
    `Building the next generation of financial tools for small businesses. Need a ${role === 'Technical cofounder' ? 'business' : 'technical'} cofounder who can build secure, scalable fintech infrastructure.`,
    `Creating developer tools that make cloud infrastructure management 10x easier. Looking for a cofounder with strong product sense.`,
    `Building an AI tutor that adapts to each student's learning style. Need a ${role === 'Technical cofounder' ? 'business' : 'technical'} cofounder who can build the ML models and platform.`,
    `Creating a decentralized identity platform that gives users control over their data. Looking for a ${role === 'Technical cofounder' ? 'business' : 'technical'} cofounder with crypto industry experience.`,
    `Building a B2B marketplace for sustainable products. Need a ${role === 'Technical cofounder' ? 'business' : 'technical'} cofounder to build the platform and handle complex matching algorithms.`,
    `Creating a social app that helps people find local communities and events. Looking for a cofounder with strong design and community building skills.`,
    `Building a platform that helps companies measure and reduce their carbon footprint. Need a ${role === 'Technical cofounder' ? 'business' : 'technical'} cofounder to build the data platform.`,
    `Creating an AI-powered security platform that prevents breaches before they happen. Looking for a ${role === 'Technical cofounder' ? 'business' : 'technical'} cofounder with enterprise sales experience.`,
    `Building a platform that helps creators build sustainable businesses. Need a ${role === 'Technical cofounder' ? 'business' : 'technical'} cofounder to build the tools and infrastructure.`
  ]
  
  return {
    display_name: `${firstName} ${lastName}`,
    role,
    location_tz: location,
    domain_expertise: domain,
    technical_expertise: tech,
    skills_background: skillsBackgrounds[index % skillsBackgrounds.length],
    interests_building: interestsBuilding[index % interestsBuilding.length],
    availability,
    links: `https://${firstName.toLowerCase()}${lastName.toLowerCase()}.dev`,
    linkedin_url: `https://www.linkedin.com/in/seed-${index}`,
  }
}

export async function POST(request: NextRequest) {
  const { authorized } = await verifyAdmin(request)
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  // Parse query params
  const { searchParams } = new URL(request.url)
  const batch = parseInt(searchParams.get('batch') || '1', 10)
  const count = parseInt(searchParams.get('count') || '10', 10)

  if (batch < 1 || count < 1 || count > 100) {
    return NextResponse.json({ error: 'Invalid batch (>=1) or count (1-100)' }, { status: 400 })
  }

  // Calculate index range
  const start = (batch - 1) * count + 1
  const end = batch * count

  let created = 0
  let skipped = 0

  for (let index = start; index <= end; index++) {
    const email = `seed+${index}@ttb.local`
    const profileData = generateProfileData(index)

    // Check if profile already exists by email
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('user_id, email')
      .eq('email', email)
      .limit(1)
      .single()

    if (existingProfile) {
      // Update existing profile
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          display_name: profileData.display_name,
          domain_expertise: profileData.domain_expertise,
          technical_expertise: profileData.technical_expertise,
          location_tz: profileData.location_tz,
          skills_background: profileData.skills_background,
          interests_building: profileData.interests_building,
          availability: profileData.availability,
          links: profileData.links,
          linkedin_url: profileData.linkedin_url,
          photo_path: '433f5223-4a95-4111-acbf-095c6c9ce9c0/avatar.webp',
          is_live: true,
          is_complete: true,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', existingProfile.user_id)

      if (updateError) {
        console.error(`Failed to update profile ${index}:`, updateError)
      } else {
        skipped++
      }
      continue
    }

    // Create new user
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
    })

    if (userError || !userData?.user?.id) {
      console.error(`Failed to create user ${index}:`, userError)
      continue
    }

    const userId = userData.user.id

    // Insert application
    const { error: appError } = await supabaseAdmin
      .from('applications')
      .insert({
        user_id: userId,
        email: email,
        linkedin: profileData.linkedin_url,
        stem_background: profileData.skills_background,
        status: 'approved',
        reviewed_at: new Date().toISOString(),
      })

    if (appError) {
      console.error(`Failed to create application for user ${index}:`, appError)
    }

    // Insert profile with all fields
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        user_id: userId,
        email: email,
        display_name: profileData.display_name,
        domain_expertise: profileData.domain_expertise,
        technical_expertise: profileData.technical_expertise,
        location_tz: profileData.location_tz,
        skills_background: profileData.skills_background,
        interests_building: profileData.interests_building,
        availability: profileData.availability,
        links: profileData.links,
        linkedin_url: profileData.linkedin_url,
        photo_path: '433f5223-4a95-4111-acbf-095c6c9ce9c0/avatar.webp',
        is_live: true,
        is_complete: true,
        whatsapp_number: null,
        whatsapp_verified: false,
        updated_at: new Date().toISOString(),
      })

    if (profileError) {
      console.error(`Failed to create profile ${index}:`, profileError)
    } else {
      created++
    }
  }

  return NextResponse.json({
    created,
    skipped,
    batch,
    count,
    indices: [start, end],
  })
}
