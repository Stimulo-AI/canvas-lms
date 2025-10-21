#!/usr/bin/env ruby
# frozen_string_literal: true

# Generate API access token for local development
user = User.find_by(id: 1)
raise "Admin user not found" unless user

# Delete existing local dev tokens
AccessToken.where(user: user, purpose: "Local Development - Playwright Automation").destroy_all

token = AccessToken.create!(
  user: user,
  developer_key: DeveloperKey.default,
  purpose: "Local Development - Playwright Automation",
  permanent_expires_at: nil,
  scopes: []
)

puts "\n========================================="
puts "Access Token Created Successfully!"
puts "========================================="
puts "Token: #{token.full_token}"
puts "Token ID: #{token.id}"
puts "User: #{user.name}"
puts "Email: admin@localhost"
puts "Purpose: #{token.purpose}"
puts "Expires: Never (local dev only)"
puts "=========================================\n"
puts "Usage in Playwright:"
puts "  page.setExtraHTTPHeaders({"
puts "    'Authorization': 'Bearer #{token.full_token}'"
puts "  });"
puts "\nOr via curl:"
puts "  curl -H 'Authorization: Bearer #{token.full_token}' \\"
puts "    http://localhost:3000/api/v1/users/self"
puts "=========================================\n"
