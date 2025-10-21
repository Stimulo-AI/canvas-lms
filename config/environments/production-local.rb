# frozen_string_literal: true

#
# Local production environment overrides
# This file is loaded after production.rb for local development
#

# Disable force_ssl for local HTTP development
# In real production deployments, leave this enabled in production.rb
config.force_ssl = ENV.fetch("FORCE_SSL", "false") == "true"

puts "[LOCAL CONFIG] force_ssl set to: #{config.force_ssl}"
